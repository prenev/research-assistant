import django_filters as df
from django.db.models import Count, Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.viewsets import NotebookViewSet

from . import citations
from .models import (
    ConditionStudied,
    Design,
    Direction,
    Finding,
    FindingContext,
    Fluid,
    FtdSubtype,
    NflInvolved,
    Paper,
    Population,
    Quality,
    ReadingStatus,
    Relevance,
    ReviewSection,
    Tag,
)
from .serializers import FindingSerializer, PaperSerializer, TagSerializer


class PaperFilter(df.FilterSet):
    population = df.ChoiceFilter(choices=Population.choices)
    design = df.ChoiceFilter(choices=Design.choices)
    reading_status = df.ChoiceFilter(choices=ReadingStatus.choices)
    review_section = df.ChoiceFilter(choices=ReviewSection.choices)
    fluid = df.ChoiceFilter(choices=Fluid.choices, method="filter_fluid")
    condition_studied = df.ChoiceFilter(choices=ConditionStudied.choices)
    nfl_involved = df.ChoiceFilter(choices=NflInvolved.choices)
    relevance = df.ChoiceFilter(choices=Relevance.choices)
    quality = df.ChoiceFilter(choices=Quality.choices)
    ftd_subtype = df.ChoiceFilter(choices=FtdSubtype.choices, method="filter_subtype")
    protein = df.CharFilter(method="filter_protein", help_text="Protein slug")
    tag = df.CharFilter(field_name="tags__slug")
    year_min = df.NumberFilter(field_name="year", lookup_expr="gte")
    year_max = df.NumberFilter(field_name="year", lookup_expr="lte")

    class Meta:
        model = Paper
        fields = [
            "population",
            "design",
            "reading_status",
            "review_section",
            "platform",
            "slug",
            "doi",
        ]

    def filter_fluid(self, qs, name, value):
        # JSON list membership is done in Python: SQLite has no JSON `contains`.
        ids = [p.id for p in qs if value in (p.fluids or [])]
        return qs.filter(id__in=ids)

    def filter_subtype(self, qs, name, value):
        ids = [p.id for p in qs if value in (p.ftd_subtypes or [])]
        return qs.filter(id__in=ids)

    def filter_protein(self, qs, name, value):
        return qs.filter(
            findings__protein__slug=value, findings__deleted_at__isnull=True
        ).distinct()


class PaperViewSet(NotebookViewSet):
    serializer_class = PaperSerializer
    filterset_class = PaperFilter
    search_fields = [
        "title", "authors", "first_author_surname", "key_finding", "doi", "journal",
        "dataset", "why_it_matters", "methods_to_borrow",
    ]  # fmt: skip
    ordering_fields = ["citation_number", "year", "sample_size", "title", "created_at"]

    def get_queryset(self):
        return (
            Paper.objects.prefetch_related("tags")
            .annotate(
                finding_count=Count(
                    "findings", filter=Q(findings__deleted_at__isnull=True), distinct=True
                )
            )
            .order_by("citation_number", "year", "title")
        )

    @action(detail=False, methods=["post"], url_path="lookup-doi")
    def lookup_doi(self, request):
        doi = citations.normalise_doi(request.data.get("doi", ""))
        if not doi:
            return Response({"detail": "Enter a DOI."}, status=status.HTTP_400_BAD_REQUEST)
        existing = Paper.all_objects.filter(doi=doi).first()
        try:
            fields = citations.paper_fields_from_crossref(citations.fetch_crossref(doi))
        except LookupError as exc:
            return Response({"found": False, "detail": str(exc), "doi": doi})
        except ConnectionError as exc:
            # Graceful fallback: the UI switches to manual entry.
            return Response({"found": False, "detail": str(exc), "doi": doi, "manual": True})
        return Response(
            {
                "found": True,
                "fields": fields,
                "duplicate": None
                if not existing
                else {
                    "id": existing.id,
                    "slug": existing.slug,
                    "trashed": bool(existing.deleted_at),
                },
            }
        )


class TagViewSet(NotebookViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    search_fields = ["name"]


class FindingFilter(df.FilterSet):
    protein = df.CharFilter(field_name="protein__slug", help_text="Protein slug")
    paper_slug = df.CharFilter(field_name="paper__slug")
    population = df.CharFilter(field_name="paper__population")
    design = df.CharFilter(field_name="paper__design")
    protein_category = df.CharFilter(field_name="protein__category")
    protein_role = df.CharFilter(field_name="protein__role")
    direction = df.ChoiceFilter(choices=Direction.choices)
    context = df.ChoiceFilter(choices=FindingContext.choices)
    fluid = df.ChoiceFilter(choices=Fluid.choices)

    class Meta:
        model = Finding
        fields = ["paper", "direction", "context", "fluid"]


class FindingViewSet(NotebookViewSet):
    serializer_class = FindingSerializer
    filterset_class = FindingFilter
    search_fields = ["context_detail", "effect", "subgroup", "notes", "protein__name"]
    ordering_fields = ["paper__year", "paper__citation_number", "protein__name"]

    def get_queryset(self):
        return Finding.objects.filter(
            paper__deleted_at__isnull=True, protein__deleted_at__isnull=True
        ).select_related("paper", "protein")


# ---- Phase 3: DOI lookup, import (preview + confirm) ----
IMPORT_FIELDS = [
    "title", "authors", "first_author_surname", "year", "journal", "volume", "issue",
    "pages", "article_number", "doi", "url", "ieee_reference",
]  # fmt: skip


def _mark_duplicates(entries):
    dois = {e["doi"] for e in entries if e.get("doi")}
    taken = set(Paper.all_objects.filter(doi__in=dois).values_list("doi", flat=True))
    seen = set()
    for e in entries:
        d = e.get("doi")
        e["duplicate"] = bool(d and (d in taken or d in seen))
        if d:
            seen.add(d)
    return entries


class ImportPreviewView(APIView):
    """POST file (multipart `file`) or JSON `{text}`. Returns parsed entries, nothing saved."""

    kind = "bibtex"

    def post(self, request):
        upload = request.FILES.get("file")
        if upload is not None:
            if upload.size > 5 * 1024 * 1024:
                return Response({"detail": "File too large (5 MB max)."}, status=400)
            text = upload.read().decode("utf-8-sig", errors="replace")
        else:
            text = request.data.get("text", "")
        if not text.strip():
            return Response({"detail": "No content to import."}, status=400)
        parse = citations.parse_bibtex if self.kind == "bibtex" else citations.parse_zotero_csv
        entries = [e for e in parse(text) if e.get("title")]
        if not entries:
            return Response({"detail": "No entries found."}, status=400)
        return Response({"entries": _mark_duplicates(entries)})


class ImportConfirmView(APIView):
    """POST `{entries: [...]}` (the previewed entries the user ticked). Duplicates are skipped."""

    def post(self, request):
        rows = request.data.get("entries")
        if not isinstance(rows, list):
            return Response({"detail": "Expected a list of entries."}, status=400)
        created, skipped = [], []
        for row in rows:
            data = {k: row.get(k) for k in IMPORT_FIELDS if k in row}
            ser = PaperSerializer(data=data)
            if not ser.is_valid():
                skipped.append({"title": row.get("title"), "errors": ser.errors})
                continue
            created.append(ser.save().id)
        return Response({"created": created, "skipped": skipped}, status=status.HTTP_201_CREATED)
