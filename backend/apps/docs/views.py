from apps.core.viewsets import NotebookViewSet

from .models import DocCategory, DocPage
from .serializers import DocCategorySerializer, DocPageSerializer


class DocCategoryViewSet(NotebookViewSet):
    queryset = DocCategory.objects.all()
    serializer_class = DocCategorySerializer
    filterset_fields = ["parent", "slug"]


class DocPageViewSet(NotebookViewSet):
    serializer_class = DocPageSerializer
    filterset_fields = ["category", "slug"]
    search_fields = ["title", "body", "description"]

    def get_queryset(self):
        return DocPage.objects.filter(category__deleted_at__isnull=True).select_related(
            "category", "last_edited_by"
        )

    def save_kwargs(self):
        return {"last_edited_by": self.request.user}
