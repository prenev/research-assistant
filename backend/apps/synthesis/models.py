from django.db import models

from apps.core.models import BaseModel, unique_slug


class Requirement(BaseModel):
    number = models.PositiveSmallIntegerField(unique=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["number"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title, 100)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"R{self.number}: {self.title}"


class Met(models.TextChoices):
    YES = "yes", "Yes"
    PARTIAL = "partial", "Partial"
    NO = "no", "No"


class RequirementAssessment(BaseModel):
    paper = models.ForeignKey(
        "literature.Paper", on_delete=models.CASCADE, related_name="assessments"
    )
    requirement = models.ForeignKey(
        Requirement, on_delete=models.CASCADE, related_name="assessments"
    )
    met = models.CharField(max_length=10, choices=Met.choices)
    justification = models.TextField(blank=True)

    class Meta:
        ordering = ["paper__citation_number", "requirement__number"]
        constraints = [
            models.UniqueConstraint(
                fields=["paper", "requirement"],
                condition=models.Q(deleted_at__isnull=True),
                name="uniq_live_assessment",
            )
        ]

    def __str__(self):
        return f"{self.paper} / R{self.requirement.number}: {self.met}"
