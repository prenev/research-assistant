from rest_framework import serializers

from .models import Finding, Paper, Tag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = "__all__"
        read_only_fields = ["deleted_at"]
        extra_kwargs = {"slug": {"required": False}}


class PaperSerializer(serializers.ModelSerializer):
    short_label = serializers.CharField(read_only=True)
    finding_count = serializers.IntegerField(read_only=True, default=0)
    doi = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Paper
        exclude = ["proteins"]
        read_only_fields = ["deleted_at"]
        extra_kwargs = {"slug": {"required": False}}

    def validate_doi(self, value):
        value = (value or "").strip().lower() or None
        if value:
            clash = Paper.all_objects.filter(doi=value).exclude(
                pk=self.instance.pk if self.instance else None
            )
            if clash.exists():
                raise serializers.ValidationError("A paper with this DOI already exists.")
        return value

    def validate_limitations(self, value):
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            raise serializers.ValidationError("Limitations must be a list of strings.")
        return value


class FindingSerializer(serializers.ModelSerializer):
    paper_label = serializers.CharField(source="paper.short_label", read_only=True)
    protein_name = serializers.CharField(source="protein.name", read_only=True)
    protein_slug = serializers.CharField(source="protein.slug", read_only=True)

    class Meta:
        model = Finding
        fields = "__all__"
        read_only_fields = ["deleted_at"]
