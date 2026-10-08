import hashlib

import django_filters as df
import wikipediaapi
from django.core.cache import cache
from django.db.models import Count, Q
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.viewsets import NotebookViewSet

from . import wiki
from .models import Protein, ProteinCategory, ProteinRole
from .serializers import ProteinSerializer


class ProteinFilter(df.FilterSet):
    category = df.ChoiceFilter(choices=ProteinCategory.choices)
    role = df.ChoiceFilter(choices=ProteinRole.choices)

    class Meta:
        model = Protein
        fields = ["category", "role", "slug"]


class ProteinViewSet(NotebookViewSet):
    serializer_class = ProteinSerializer
    filterset_class = ProteinFilter
    search_fields = ["name", "slug", "aliases", "olink_assay_name", "rationale"]
    ordering_fields = ["name", "category", "role", "finding_count"]

    def get_queryset(self):
        return Protein.objects.annotate(
            finding_count=Count(
                "findings",
                filter=Q(
                    findings__deleted_at__isnull=True, findings__paper__deleted_at__isnull=True
                ),
            )
        ).order_by("name")

    WIKI_CACHE_SECONDS = 24 * 3600

    @action(detail=True, methods=["get"], url_path="wikipedia")
    def wikipedia(self, request, pk=None):
        """Background article for this protein (text, sections, images) for the in-app info view."""
        protein = self.get_object()
        ident = f"{protein.pk}|{protein.wikipedia_title}|{protein.name}|{'|'.join(protein.aliases)}"
        key = "wiki:" + hashlib.md5(ident.encode()).hexdigest()  # noqa: S324 (cache key only)
        if request.query_params.get("refresh") != "1":
            cached = cache.get(key)
            if cached is not None:
                return Response(cached)
        try:
            data = wiki.article_for(protein.name, protein.aliases, protein.wikipedia_title)
        except wikipediaapi.WikipediaException:
            # Network or Wikipedia trouble: say so, and do not cache it.
            return Response(
                {"found": False, "error": "unreachable", "detail": "Could not reach Wikipedia."}
            )
        cache.set(key, data, self.WIKI_CACHE_SECONDS if data["found"] else 600)
        return Response(data)
