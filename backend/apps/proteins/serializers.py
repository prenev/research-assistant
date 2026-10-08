from rest_framework import serializers

from .models import Protein


class ProteinSerializer(serializers.ModelSerializer):
    finding_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Protein
        fields = "__all__"
        read_only_fields = ["deleted_at"]
        extra_kwargs = {"slug": {"required": False}}

    def validate_aliases(self, value):
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            raise serializers.ValidationError("Aliases must be a list of strings.")
        return value
