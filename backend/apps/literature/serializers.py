import re

from rest_framework import serializers

from .models import Finding, Paper, Tag


class TagSerializer(serializers.ModelSerializer):
    counts = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()

    class Meta:
        model = Tag
        fields = "__all__"
        read_only_fields = ["deleted_at"]
        extra_kwargs = {"slug": {"required": False}, "colour": {"required": False}}

    def validate_colour(self, value):
        if value and not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            raise serializers.ValidationError("Use a hex colour such as #2a78d6.")
        return value.lower()

    def validate_name(self, value):
        value = value.strip().lstrip("#")
        clash = Tag.objects.filter(name__iexact=value).exclude(
            pk=self.instance.pk if self.instance else None
        )
        if clash.exists():
            raise serializers.ValidationError("A tag with this name already exists.")
        return value

    def get_counts(self, obj):
        return {
            "papers": getattr(obj, "n_papers", 0),
            "proteins": getattr(obj, "n_proteins", 0),
            "docs": getattr(obj, "n_docs", 0),
            "log": getattr(obj, "n_log", 0),
            "decisions": getattr(obj, "n_decisions", 0),
        }

    def get_total(self, obj):
        return sum(self.get_counts(obj).values())


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
    paper_slug = serializers.CharField(source="paper.slug", read_only=True)
    paper_population = serializers.CharField(source="paper.population", read_only=True)
    paper_design = serializers.CharField(source="paper.design", read_only=True)
    protein_name = serializers.CharField(source="protein.name", read_only=True)
    protein_slug = serializers.CharField(source="protein.slug", read_only=True)

    class Meta:
        model = Finding
        fields = "__all__"
        read_only_fields = ["deleted_at"]
