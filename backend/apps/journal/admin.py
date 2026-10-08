from django.contrib import admin

from apps.core.admin import SoftDeleteAdmin

from .models import LogPost


@admin.register(LogPost)
class LogPostAdmin(SoftDeleteAdmin):
    pass
