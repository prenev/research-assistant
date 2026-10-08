from django.contrib import admin

from apps.core.admin import SoftDeleteAdmin

from .models import Protein


@admin.register(Protein)
class ProteinAdmin(SoftDeleteAdmin):
    pass
