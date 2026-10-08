from rest_framework import serializers

from .models import LogPost


class LogPostSerializer(serializers.ModelSerializer):
    reading_time_minutes = serializers.SerializerMethodField()

    class Meta:
        model = LogPost
        fields = "__all__"
        read_only_fields = ["deleted_at"]
        extra_kwargs = {"slug": {"required": False}, "summary": {"required": False}}

    def get_reading_time_minutes(self, obj):
        return max(1, round(len(obj.body.split()) / 200))
