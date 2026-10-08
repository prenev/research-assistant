from rest_framework import serializers

from .models import Requirement, RequirementAssessment


class RequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Requirement
        fields = "__all__"
        read_only_fields = ["deleted_at"]
        extra_kwargs = {"slug": {"required": False}}


class RequirementAssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequirementAssessment
        fields = "__all__"
        read_only_fields = ["deleted_at"]

    def validate(self, attrs):
        paper = attrs.get("paper", getattr(self.instance, "paper", None))
        req = attrs.get("requirement", getattr(self.instance, "requirement", None))
        clash = RequirementAssessment.objects.filter(paper=paper, requirement=req)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError(
                "This paper already has an assessment for that requirement."
            )
        return attrs
