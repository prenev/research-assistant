from apps.core.viewsets import NotebookViewSet

from .models import Decision, PipelineStage, ResultEntry
from .serializers import DecisionSerializer, PipelineStageSerializer, ResultEntrySerializer


class PipelineStageViewSet(NotebookViewSet):
    queryset = PipelineStage.objects.all()
    serializer_class = PipelineStageSerializer
    filterset_fields = ["status", "slug"]
    search_fields = ["title", "description"]


class DecisionViewSet(NotebookViewSet):
    queryset = Decision.objects.select_related("related_stage")
    serializer_class = DecisionSerializer
    filterset_fields = ["status", "prespecified", "related_stage", "slug"]
    search_fields = ["title", "decision", "rationale"]


class ResultEntryViewSet(NotebookViewSet):
    queryset = ResultEntry.objects.all()
    serializer_class = ResultEntrySerializer
    filterset_fields = ["model_label", "metric", "linked_stage"]
    search_fields = ["title", "notes"]
