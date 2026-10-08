from django.contrib import admin

from apps.core.admin import SoftDeleteAdmin

from .models import Requirement, RequirementAssessment


@admin.register(Requirement)
class RequirementAdmin(SoftDeleteAdmin):
    pass


@admin.register(RequirementAssessment)
class RequirementAssessmentAdmin(SoftDeleteAdmin):
    pass
