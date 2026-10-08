from apps.core.viewsets import NotebookViewSet

from .models import LogPost
from .serializers import LogPostSerializer


class LogPostViewSet(NotebookViewSet):
    serializer_class = LogPostSerializer
    filterset_fields = {"date": ["gte", "lte", "exact"], "tags__slug": ["exact"], "slug": ["exact"]}
    search_fields = ["title", "body", "summary"]

    def get_queryset(self):
        return LogPost.objects.prefetch_related(
            "tags", "linked_papers", "linked_proteins", "linked_pipeline_stages"
        )
