from django.contrib import admin

from apps.core.admin import SoftDeleteAdmin

from .models import Decision, PipelineStage, ResultEntry


@admin.register(PipelineStage)
class PipelineStageAdmin(SoftDeleteAdmin):
    pass


@admin.register(Decision)
class DecisionAdmin(SoftDeleteAdmin):
    pass


@admin.register(ResultEntry)
class ResultEntryAdmin(SoftDeleteAdmin):
    pass
