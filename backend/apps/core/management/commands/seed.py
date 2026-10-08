"""Idempotent seed loader. Creates missing rows only, so it never overwrites your edits."""

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.core.models import SiteSettings
from apps.docs.models import DocCategory, DocPage
from apps.journal.models import LogPost
from apps.project.models import Decision, PipelineStage
from apps.proteins.models import Protein
from apps.synthesis.models import Requirement

SEED_DIR = Path(settings.BASE_DIR) / "fixtures" / "seed"


def load(name):
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


class Command(BaseCommand):
    help = "Load seed data (safe to run repeatedly)."

    @transaction.atomic
    def handle(self, *args, **opts):
        created = {}

        def note(kind, was_created):
            created[kind] = created.get(kind, 0) + int(was_created)

        site = SiteSettings.load()
        if not site.research_question:
            site.research_question = (
                "Can a minimal panel of circulating inflammatory proteins improve the prediction "
                "of incident frontotemporal dementia (FTD) beyond demographics and established "
                "blood biomarkers?"
            )
            site.footer_text = (
                "FTD Inflammation Notebook. No participant-level data is stored here."
            )
            site.save()

        for r in load("requirements.json"):
            _, c = Requirement.all_objects.get_or_create(number=r["number"], defaults=r)
            note("requirements", c)

        for p in load("proteins.json"):
            exists = Protein.all_objects.filter(name=p["name"]).exists()
            if not exists:
                Protein.objects.create(**p)
            note("proteins", not exists)

        stages = {}
        for i, s in enumerate(load("pipeline_stages.json"), start=1):
            obj = PipelineStage.all_objects.filter(title=s["title"]).first()
            if obj is None:
                obj = PipelineStage.objects.create(title=s["title"], position=i)
                note("pipeline_stages", True)
            stages[s["title"]] = obj

        for d in load("decisions.json"):
            if Decision.all_objects.filter(title=d["title"]).exists():
                continue
            d = dict(d)
            d["related_stage"] = stages.get(d.pop("related_stage", None))
            Decision.objects.create(**d)
            note("decisions", True)

        for pos, cat in enumerate(load("docs.json")):
            category = DocCategory.all_objects.filter(title=cat["title"], parent=None).first()
            if category is None:
                category = DocCategory.objects.create(title=cat["title"], position=pos)
                note("doc_categories", True)
            for ppos, page in enumerate(cat["pages"]):
                if DocPage.all_objects.filter(slug=page["slug"]).exists():
                    continue
                body = (SEED_DIR / "docs" / page["body_file"]).read_text(encoding="utf-8")
                DocPage.objects.create(
                    title=page["title"],
                    slug=page["slug"],
                    category=category,
                    position=ppos,
                    body=body,
                )
                note("doc_pages", True)

        if not LogPost.all_objects.filter(slug="notebook-set-up").exists():
            LogPost.objects.create(
                title="Notebook set up",
                slug="notebook-set-up",
                date=timezone.localdate(),
                body=(SEED_DIR / "log_notebook_setup.md").read_text(encoding="utf-8"),
            )
            note("log_posts", True)

        self.stdout.write(
            self.style.SUCCESS(f"Seed complete. Newly created: {created or 'nothing'}")
        )
        self.stdout.write("Papers, findings and A3 text are not seeded; see SEED_DATA_TODO.md.")
