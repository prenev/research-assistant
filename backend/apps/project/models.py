from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel, unique_slug


class StageStatus(models.TextChoices):
    NOT_STARTED = "not_started", "Not started"
    IN_PROGRESS = "in_progress", "In progress"
    BLOCKED = "blocked", "Blocked"
    DONE = "done", "Done"


class PipelineStage(BaseModel):
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    position = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=StageStatus.choices, default=StageStatus.NOT_STARTED
    )
    started_on = models.DateField(null=True, blank=True)
    completed_on = models.DateField(null=True, blank=True)
    blocked_reason = models.CharField(max_length=300, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["position", "id"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title, 220)
        today = timezone.localdate()
        if self.status == StageStatus.IN_PROGRESS and not self.started_on:
            self.started_on = today
        if self.status == StageStatus.DONE:
            self.started_on = self.started_on or today
            self.completed_on = self.completed_on or today
        elif self.status != StageStatus.DONE:
            self.completed_on = None
        if self.status != StageStatus.BLOCKED:
            self.blocked_reason = ""
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class DecisionStatus(models.TextChoices):
    PROPOSED = "proposed", "Proposed"
    ADOPTED = "adopted", "Adopted"
    SUPERSEDED = "superseded", "Superseded"


class Decision(BaseModel):
    date = models.DateField(null=True, blank=True)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    title = models.CharField(max_length=250)
    decision = models.TextField(blank=True)
    rationale = models.TextField(blank=True)
    prespecified = models.BooleanField(default=False, help_text="Made before seeing outcome data.")
    related_stage = models.ForeignKey(
        PipelineStage, null=True, blank=True, on_delete=models.SET_NULL, related_name="decisions"
    )
    status = models.CharField(
        max_length=12, choices=DecisionStatus.choices, default=DecisionStatus.PROPOSED
    )
    superseded_by = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="supersedes"
    )

    class Meta:
        ordering = ["date", "id"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title, 220)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class ModelLabel(models.TextChoices):
    M1 = "M1", "M1 (age + sex)"
    M2 = "M2", "M2 (M1 + NfL)"
    M3 = "M3", "M3 (M2 + inflammatory proteins)"
    OTHER = "other", "Other"


class Metric(models.TextChoices):
    TD_AUC = "time_dependent_auc", "Time-dependent AUC"
    DELTA_AUC = "delta_auc", "Delta AUC"
    C_INDEX = "c_index", "C-index"
    CAL_SLOPE = "calibration_slope", "Calibration slope"
    BRIER = "brier", "Brier score"
    OTHER = "other", "Other"


class ResultEntry(BaseModel):
    """Permitted aggregate results only. Never participant-level data."""

    title = models.CharField(max_length=200)
    date = models.DateField(default=timezone.localdate)
    model_label = models.CharField(max_length=10, choices=ModelLabel.choices)
    metric = models.CharField(max_length=30, choices=Metric.choices)
    value = models.DecimalField(max_digits=10, decimal_places=4)
    ci_lower = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    ci_upper = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    horizon_years = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    n_participants = models.PositiveIntegerField(null=True, blank=True)
    n_events = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    linked_stage = models.ForeignKey(
        PipelineStage, null=True, blank=True, on_delete=models.SET_NULL, related_name="results"
    )
    confirmed_permitted = models.BooleanField(
        default=False,
        help_text="Ticked to confirm a figure with a low event count is permitted to be shown.",
    )

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name_plural = "result entries"

    def __str__(self):
        return self.title
