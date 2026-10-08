from django.contrib import admin

from apps.core.admin import SoftDeleteAdmin

from .models import Finding, Paper, Tag


@admin.register(Tag)
class TagAdmin(SoftDeleteAdmin):
    pass


@admin.register(Paper)
class PaperAdmin(SoftDeleteAdmin):
    pass


@admin.register(Finding)
class FindingAdmin(SoftDeleteAdmin):
    pass
