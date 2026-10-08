from django.contrib import admin

from apps.core.admin import SoftDeleteAdmin

from .models import DocCategory, DocPage


@admin.register(DocCategory)
class DocCategoryAdmin(SoftDeleteAdmin):
    pass


@admin.register(DocPage)
class DocPageAdmin(SoftDeleteAdmin):
    pass
