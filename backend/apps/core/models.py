from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from simple_history.models import HistoricalRecords


class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):
        return self.update(deleted_at=timezone.now())

    def hard_delete(self):
        return super().delete()


class SoftDeleteManager(models.Manager.from_queryset(SoftDeleteQuerySet)):
    """Default manager: hides soft-deleted rows."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class BaseModel(models.Model):
    """Timestamps, soft delete (30-day Trash) and version history for every editable model."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    objects = SoftDeleteManager()
    all_objects = SoftDeleteQuerySet.as_manager()
    history = HistoricalRecords(inherit=True)

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])

    def hard_delete(self):
        super().delete()

    def restore(self):
        self.deleted_at = None
        self.save(update_fields=["deleted_at", "updated_at"])


GREEK = {
    "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "epsilon", "κ": "kappa",
    "λ": "lambda", "μ": "mu", "ω": "omega",
}  # fmt: skip


def slug_base(text):
    """Slug text with Greek letters spelled out, so 'TNF-α' becomes 'tnf-alpha', not 'tnf'."""
    for ch, name in GREEK.items():
        text = text.replace(ch, f"-{name}-").replace(ch.upper(), f"-{name}-")
    return slugify(text)


def unique_slug(instance, base, max_length=200):
    """Generate a slug from `base`, unique among all rows (including trashed) of the model."""
    model = type(instance)
    root = slug_base(base)[: max_length - 8] or "item"
    slug, n = root, 2
    qs = model.all_objects.exclude(pk=instance.pk)
    while qs.filter(slug=slug).exists():
        slug = f"{root}-{n}"
        n += 1
    return slug


class SiteSettings(models.Model):
    """Singleton (pk=1)."""

    site_title = models.CharField(max_length=120, default="FTD Inflammation Notebook")
    tagline = models.CharField(
        max_length=200, default="Can a minimal inflammatory panel predict incident FTD?"
    )
    research_question = models.TextField(blank=True)
    logo = models.ImageField(upload_to="logo/", blank=True)
    primary_colour = models.CharField(max_length=7, default="#1f7a8c")
    footer_text = models.CharField(max_length=300, blank=True)
    public_read = models.BooleanField(default=False)
    min_event_count_warning = models.PositiveIntegerField(default=10)
    weekly_reading_goal = models.PositiveSmallIntegerField(
        default=3, help_text="Papers to finish reading each week. 0 turns the goal off."
    )
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name_plural = "site settings"

    def __str__(self):
        return self.site_title

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
