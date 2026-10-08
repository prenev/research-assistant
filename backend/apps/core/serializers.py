from rest_framework import serializers

from .models import SiteSettings


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        exclude = ["id"]
        read_only_fields = ["updated_at"]

    def validate_primary_colour(self, value):
        import re

        if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            raise serializers.ValidationError("Use a hex colour like #1f7a8c.")
        return value
