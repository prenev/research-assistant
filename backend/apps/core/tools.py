"""Uploads, Trash, and export endpoints."""

import uuid
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage
from django.http import HttpResponse
from django.utils import timezone
from PIL import Image, UnidentifiedImageError
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.docs.models import DocCategory, DocPage
from apps.docs.serializers import DocCategorySerializer, DocPageSerializer
from apps.journal.models import LogPost
from apps.journal.serializers import LogPostSerializer
from apps.literature.citations import bibtex_entry
from apps.literature.models import Finding, Paper, Tag
from apps.literature.serializers import FindingSerializer, PaperSerializer, TagSerializer
from apps.project.models import Decision, PipelineStage, ResultEntry
from apps.project.serializers import (
    DecisionSerializer,
    PipelineStageSerializer,
    ResultEntrySerializer,
)
from apps.proteins.models import Protein
from apps.proteins.serializers import ProteinSerializer
from apps.synthesis.models import Requirement, RequirementAssessment
from apps.synthesis.serializers import RequirementAssessmentSerializer, RequirementSerializer

from .models import SiteSettings
from .serializers import SiteSettingsSerializer

TRASH_DAYS = 30

# type key -> (model, label getter, serializer)
REGISTRY = {
    "paper": (Paper, lambda o: o.title, PaperSerializer),
    "protein": (Protein, lambda o: o.name, ProteinSerializer),
    "finding": (Finding, str, FindingSerializer),
    "tag": (Tag, lambda o: o.name, TagSerializer),
    "doc-category": (DocCategory, lambda o: o.title, DocCategorySerializer),
    "doc-page": (DocPage, lambda o: o.title, DocPageSerializer),
    "log-post": (LogPost, lambda o: o.title, LogPostSerializer),
    "pipeline-stage": (PipelineStage, lambda o: o.title, PipelineStageSerializer),
    "decision": (Decision, lambda o: o.title, DecisionSerializer),
    "result": (ResultEntry, lambda o: o.title, ResultEntrySerializer),
    "requirement": (Requirement, str, RequirementSerializer),
    "requirement-assessment": (RequirementAssessment, str, RequirementAssessmentSerializer),
}


class TrashView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        items = []
        for key, (model, label, _) in REGISTRY.items():
            for o in model.all_objects.filter(deleted_at__isnull=False):
                days_left = TRASH_DAYS - (now - o.deleted_at).days
                items.append(
                    {
                        "type": key,
                        "id": o.pk,
                        "title": label(o),
                        "deleted_at": o.deleted_at,
                        "days_left": max(days_left, 0),
                    }
                )
        items.sort(key=lambda i: i["deleted_at"], reverse=True)
        return Response(items)

    def post(self, request):
        """Restore: {"type": "paper", "id": 1}."""
        entry = REGISTRY.get(request.data.get("type"))
        if not entry:
            return Response({"detail": "Unknown type."}, status=status.HTTP_400_BAD_REQUEST)
        obj = (
            entry[0].all_objects.filter(pk=request.data.get("id"), deleted_at__isnull=False).first()
        )
        if not obj:
            return Response({"detail": "Not in trash."}, status=status.HTTP_404_NOT_FOUND)
        obj.restore()
        return Response({"restored": True})

    def delete(self, request):
        """Delete forever: {"type": "paper", "id": 1}, or {"all_expired": true}."""
        if request.data.get("all_expired"):
            cutoff = timezone.now() - timedelta(days=TRASH_DAYS)
            n = 0
            for model, _, _ in REGISTRY.values():
                for o in model.all_objects.filter(deleted_at__lt=cutoff):
                    o.hard_delete()
                    n += 1
            return Response({"purged": n})
        entry = REGISTRY.get(request.data.get("type"))
        obj = (
            entry
            and entry[0]
            .all_objects.filter(pk=request.data.get("id"), deleted_at__isnull=False)
            .first()
        )
        if not obj:
            return Response({"detail": "Not in trash."}, status=status.HTTP_404_NOT_FOUND)
        obj.hard_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UploadView(APIView):
    """Images for the editor. Raster formats only (SVG can carry scripts)."""

    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]
    MAX_BYTES = 10 * 1024 * 1024
    FORMATS = {"JPEG": ".jpg", "PNG": ".png", "GIF": ".gif", "WEBP": ".webp"}

    def post(self, request):
        f = request.FILES.get("file")
        if f is None:
            return Response({"detail": "No file."}, status=status.HTTP_400_BAD_REQUEST)
        if f.size > self.MAX_BYTES:
            return Response({"detail": "Image too large (10 MB max)."}, status=400)
        try:
            img = Image.open(f)
            img.verify()
            ext = self.FORMATS.get(img.format or "")
        except (UnidentifiedImageError, OSError, SyntaxError):
            ext = None
        if not ext:
            return Response({"detail": "Upload a JPEG, PNG, GIF or WebP image."}, status=400)
        f.seek(0)
        name = default_storage.save(f"uploads/{uuid.uuid4().hex}{ext}", f)
        return Response({"url": settings.MEDIA_URL + Path(name).as_posix()}, status=201)


class ExportJsonView(APIView):
    def get(self, request):
        data = {"exported_at": timezone.now().isoformat()}
        for key, (model, _, ser) in REGISTRY.items():
            data[key.replace("-", "_") + "s"] = ser(model.objects.all(), many=True).data
        data["settings"] = SiteSettingsSerializer(
            SiteSettings.load(), context={"request": request}
        ).data
        resp = Response(data)
        resp["Content-Disposition"] = 'attachment; filename="ftd-notebook-export.json"'
        return resp


def _text(body: str, filename: str, mime: str):
    resp = HttpResponse(body, content_type=f"{mime}; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp


class ExportBibtexView(APIView):
    def get(self, request):
        return _text(
            "\n\n".join(bibtex_entry(p) for p in Paper.objects.all()) + "\n",
            "papers.bib",
            "application/x-bibtex",
        )


class ExportIeeeView(APIView):
    """Reference list ordered by citation number (un-numbered papers last, by year)."""

    def get(self, request):
        papers = sorted(
            Paper.objects.all(),
            key=lambda p: (p.citation_number is None, p.citation_number or 0, p.year or 0),
        )
        lines = []
        for p in papers:
            ref = p.ieee_reference or p.title
            lines.append(f"[{p.citation_number}] {ref}" if p.citation_number else ref)
        return _text("\n".join(lines) + "\n", "references-ieee.txt", "text/plain")
