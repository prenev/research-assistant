from rest_framework import serializers

from apps.core.models import SiteSettings

from .models import Decision, PipelineStage, ResultEntry


class PipelineStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PipelineStage
        fields = "__all__"
        read_only_fields = ["deleted_at"]
        extra_kwargs = {"slug": {"required": False}}


class DecisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Decision
        fields = "__all__"
        read_only_fields = ["deleted_at"]
        extra_kwargs = {"slug": {"required": False}}

    def validate(self, attrs):
        sup = attrs.get("superseded_by")
        if sup and self.instance and sup.pk == self.instance.pk:
            raise serializers.ValidationError(
                {"superseded_by": "A decision cannot supersede itself."}
            )
        return attrs


class ResultEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = ResultEntry
        fields = "__all__"
        read_only_fields = ["deleted_at"]

    def validate(self, attrs):
        get = lambda k: attrs.get(k, getattr(self.instance, k, None))  # noqa: E731
        lo, hi = get("ci_lower"), get("ci_upper")
        if lo is not None and hi is not None and lo > hi:
            raise serializers.ValidationError({"ci_lower": "Lower bound exceeds upper bound."})
        n_events = get("n_events")
        minimum = SiteSettings.load().min_event_count_warning
        if n_events is not None and n_events < minimum and not get("confirmed_permitted"):
            raise serializers.ValidationError(
                {
                    "confirmed_permitted": (
                        f"Fewer than {minimum} events. Tick the confirmation that this figure "
                        "is permitted to be shown (see the Data policy)."
                    )
                }
            )
        return attrs
