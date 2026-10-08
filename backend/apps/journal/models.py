import re

from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel, unique_slug

TRUNCATE = "<!-- truncate -->"


class LogPost(BaseModel):
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    date = models.DateField(default=timezone.localdate)
    body = models.TextField(blank=True)
    draft_body = models.TextField(blank=True)
    summary = models.TextField(blank=True)
    tags = models.ManyToManyField("literature.Tag", blank=True, related_name="log_posts")
    linked_papers = models.ManyToManyField("literature.Paper", blank=True, related_name="log_posts")
    linked_proteins = models.ManyToManyField(
        "proteins.Protein", blank=True, related_name="log_posts"
    )
    linked_pipeline_stages = models.ManyToManyField(
        "project.PipelineStage", blank=True, related_name="log_posts"
    )

    class Meta:
        ordering = ["-date", "-created_at"]

    def auto_summary(self):
        text = self.body.split(TRUNCATE)[0] if TRUNCATE in self.body else self.body
        first = next((p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()), "")
        return first[:300]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, f"{self.date}-{self.title}", 220)
        if not self.summary:
            self.summary = self.auto_summary()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title
