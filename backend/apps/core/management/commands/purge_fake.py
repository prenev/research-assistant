from django.core.management.base import BaseCommand

from apps.literature.models import Finding, Paper, Tag
from apps.proteins.models import Protein

from .seed_fake import FAKE_TAG


class Command(BaseCommand):
    help = "Permanently delete everything made by seed_fake (and nothing else)."

    def handle(self, *args, **opts):
        f = Finding.all_objects.filter(notes="FAKE").count()
        Finding.all_objects.filter(notes="FAKE").hard_delete()
        n_p = Paper.all_objects.filter(
            slug__startswith="fake-paper-", title__startswith="[FAKE]"
        ).count()
        Paper.all_objects.filter(
            slug__startswith="fake-paper-", title__startswith="[FAKE]"
        ).hard_delete()
        n_r = Protein.all_objects.filter(
            slug__startswith="fake-p", name__startswith="FAKE-P"
        ).count()
        Protein.all_objects.filter(
            slug__startswith="fake-p", name__startswith="FAKE-P"
        ).hard_delete()
        Tag.all_objects.filter(slug=FAKE_TAG).hard_delete()
        self.stdout.write(f"Removed fake data: {n_p} papers, {n_r} proteins, {f} findings.")
