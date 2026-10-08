import django_filters as df
from django.db.models import Count, Q

from apps.core.viewsets import NotebookViewSet

from .models import (
    Design,
    Direction,
    Finding,
    FindingContext,
    Fluid,
    Paper,
    Population,
    ReadingStatus,
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

    def filter_protein(self, qs, name, value):
        return qs.filter(
            findings__protein__slug=value, findings__deleted_at__isnull=True
        ).distinct()


class PaperViewSet(NotebookViewSet):
    serializer_class = PaperSerializer
    filterset_class = PaperFilter
    search_fields = ["title", "authors", "first_author_surname", "key_finding", "doi", "journal"]
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
