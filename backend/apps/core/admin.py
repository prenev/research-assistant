from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin

from .models import SiteSettings


class SoftDeleteAdmin(SimpleHistoryAdmin):
    """Shows trashed rows too (via all_objects) so they can be inspected/restored."""

    list_filter = ("deleted_at",)

    def get_queryset(self, request):
        qs = self.model.all_objects.all()
        ordering = self.get_ordering(request)
        return qs.order_by(*ordering) if ordering else qs


@admin.register(SiteSettings)
class SiteSettingsAdmin(SimpleHistoryAdmin):
    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
