from apps.core.viewsets import NotebookViewSet

from .models import Requirement, RequirementAssessment
from .serializers import RequirementAssessmentSerializer, RequirementSerializer


class RequirementViewSet(NotebookViewSet):
    queryset = Requirement.objects.all()
    serializer_class = RequirementSerializer


class RequirementAssessmentViewSet(NotebookViewSet):
    queryset = RequirementAssessment.objects.select_related("paper", "requirement")
    serializer_class = RequirementAssessmentSerializer
    filterset_fields = ["paper", "requirement", "met"]
