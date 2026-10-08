from datetime import timedelta

from django.apps import apps
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.core.models import BaseModel


class Command(BaseCommand):
    help = "Permanently delete soft-deleted rows older than 30 days."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=30)

    def handle(self, *args, days, **opts):
        cutoff = timezone.now() - timedelta(days=days)
        total = 0
        for model in apps.get_models():
            if issubclass(model, BaseModel) and not model._meta.abstract:
                qs = model.all_objects.filter(deleted_at__lt=cutoff)
                total += qs.count()
                for obj in qs:
                    obj.hard_delete()
        self.stdout.write(f"Purged {total} trashed rows.")
