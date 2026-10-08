from rest_framework.permissions import SAFE_METHODS, BasePermission


class ReadPublicWriteAuth(BasePermission):
    """Read needs login unless SiteSettings.public_read; write always needs login."""

    def has_permission(self, request, view):
        if request.user and request.user.is_authenticated:
            return True
        if request.method in SAFE_METHODS:
            from .models import SiteSettings

            return SiteSettings.load().public_read
        return False
