import django_filters as df
from django.db.models import Count, Q

from apps.core.viewsets import NotebookViewSet

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
