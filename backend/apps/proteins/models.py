from django.db import models

from apps.core.models import BaseModel, unique_slug


class ProteinCategory(models.TextChoices):
    CYTOKINE = "cytokine", "Cytokine"
    CHEMOKINE = "chemokine", "Chemokine"
    CYTOKINE_RECEPTOR = "cytokine_receptor", "Cytokine receptor"
    GROWTH_FACTOR = "growth_factor", "Growth factor"
    COMPLEMENT = "complement", "Complement"
    ACUTE_PHASE = "acute_phase", "Acute-phase protein"
    NEURODEGENERATION_MARKER = "neurodegeneration_marker", "Neurodegeneration marker"
    OTHER = "other", "Other"


class ProteinRole(models.TextChoices):
    CANDIDATE = "candidate", "Candidate"
    COMPARATOR = "comparator", "Comparator"
    EXCLUDED = "excluded", "Excluded"
    SELECTED = "selected", "Selected"
    UNDER_REVIEW = "under_review", "Under review"


class Protein(BaseModel):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    aliases = models.JSONField(default=list, blank=True)
    olink_assay_name = models.CharField(max_length=80, blank=True)
    category = models.CharField(
        max_length=30, choices=ProteinCategory.choices, default=ProteinCategory.OTHER
    )
    on_olink_panel = models.CharField(max_length=120, blank=True)
    role = models.CharField(
        max_length=20, choices=ProteinRole.choices, default=ProteinRole.CANDIDATE
    )
    rationale = models.TextField(blank=True)
    exclusion_reason = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name, 140)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
