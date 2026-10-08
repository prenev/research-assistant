from django.db import transaction
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.viewsets import NotebookViewSet

from .models import Decision, PipelineStage, ResultEntry
from .serializers import DecisionSerializer, PipelineStageSerializer, ResultEntrySerializer


class PipelineStageViewSet(NotebookViewSet):
    queryset = PipelineStage.objects.all()
    serializer_class = PipelineStageSerializer
    filterset_fields = ["status", "slug"]
    search_fields = ["title", "description"]

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        """Body: {"ids": [stage ids in the new order]}."""
        ids = request.data.get("ids")
        stages = {s.pk: s for s in PipelineStage.objects.all()}
        if not isinstance(ids, list) or set(ids) != set(stages) or len(ids) != len(stages):
            return Response({"detail": "Send every stage id exactly once."}, status=400)
        with transaction.atomic():
            for pos, pk in enumerate(ids):
                if stages[pk].position != pos:
                    stages[pk].position = pos
                    stages[pk].save()
        return Response(self.get_serializer(PipelineStage.objects.all(), many=True).data)


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
