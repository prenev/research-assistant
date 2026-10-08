from django.conf import settings
from django.db import models

from apps.core.models import BaseModel, unique_slug


class DocCategory(BaseModel):
    title = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    position = models.PositiveIntegerField(default=0)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="children"
    )
    collapsed_by_default = models.BooleanField(default=False)
    description = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["position", "title"]
        verbose_name_plural = "doc categories"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title, 140)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class DocPage(BaseModel):
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    category = models.ForeignKey(DocCategory, on_delete=models.CASCADE, related_name="pages")
    position = models.PositiveIntegerField(default=0)
    body = models.TextField(blank=True)
    draft_body = models.TextField(blank=True, help_text="Autosaved, unpublished edits.")
    description = models.CharField(max_length=300, blank=True)
    sidebar_label = models.CharField(max_length=120, blank=True)
    tags = models.ManyToManyField("literature.Tag", blank=True, related_name="doc_pages")
    last_edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["position", "title"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title, 220)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title
