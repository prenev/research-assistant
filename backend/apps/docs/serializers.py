from rest_framework import serializers

from .models import DocCategory, DocPage


class DocCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DocCategory
        fields = "__all__"
        read_only_fields = ["deleted_at"]
        extra_kwargs = {"slug": {"required": False}}

    def validate_parent(self, value):
        node = value
        while node is not None:
            if self.instance and node.pk == self.instance.pk:
                raise serializers.ValidationError("A category cannot be its own ancestor.")
            node = node.parent
        return value


class DocPageSerializer(serializers.ModelSerializer):
    category_slug = serializers.CharField(source="category.slug", read_only=True)
    has_draft = serializers.SerializerMethodField()
    last_edited_by_name = serializers.CharField(
        source="last_edited_by.username", read_only=True, default=None
    )

    class Meta:
        model = DocPage
        fields = "__all__"
        read_only_fields = ["deleted_at", "last_edited_by"]
        extra_kwargs = {"slug": {"required": False}}

    def get_has_draft(self, obj):
        return bool(obj.draft_body) and obj.draft_body != obj.body
