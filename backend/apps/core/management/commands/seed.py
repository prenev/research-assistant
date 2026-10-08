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


def same_text(a: str, b: str) -> bool:
    return a.strip() == b.strip()


class Command(BaseCommand):
    help = "Load seed data (safe to run repeatedly)."

    def seed_docs(self, note):
        """Create the docs sidebar, and move an older seeded sidebar over to it without ever
        overwriting something you wrote: only pages whose text is still exactly what an earlier
        seed wrote are replaced or retired (to the Trash, restorable for 30 days)."""
        legacy = load("legacy_seed.json")
        legacy.pop("_categories", None)
        plan = load("docs.json")
        wanted = {p["slug"] for c in plan for p in c["pages"]}

        # 1. categories: reuse (and rename) an older seeded category, else create one
        categories = {}
        for pos, cat in enumerate(plan):
            obj = DocCategory.all_objects.filter(slug=cat["slug"], parent=None).first()
            if obj is None:
                for old_title in cat.get("renames", []):
                    obj = DocCategory.objects.filter(title=old_title, parent=None).first()
                    if obj:
                        obj.title, obj.slug, obj.position = cat["title"], cat["slug"], pos
                        obj.save()
                        note("doc_categories_renamed", True)
                        break
            if obj is None:
                obj = DocCategory.objects.filter(title=cat["title"], parent=None).first()
            if obj is None:
                obj = DocCategory.objects.create(title=cat["title"], slug=cat["slug"], position=pos)
                note("doc_categories", True)
            categories[cat["slug"]] = obj

        # 2. retire old seeded pages that are no longer wanted, if untouched
        for slug, old in legacy.items():
            if slug in wanted:
                continue
            page = DocPage.objects.filter(slug=slug).first()
            if page is None:
                continue
            untouched = not page.draft_body and any(same_text(page.body, b) for b in old["bodies"])
            if untouched:
                page.delete()
                note("doc_pages_retired", True)
            else:
                self.stdout.write(
                    f"Kept '{page.title}': you have edited it, so it was not retired."
                )

        # 3. pages: create missing; refresh untouched older seed pages; never touch edited ones
        for cat in plan:
            category = categories[cat["slug"]]
            for ppos, page in enumerate(cat["pages"]):
                body = (SEED_DIR / "docs" / page["body_file"]).read_text(encoding="utf-8")
                existing = DocPage.all_objects.filter(slug=page["slug"]).first()
                if existing is None:
                    DocPage.objects.create(
                        title=page["title"], slug=page["slug"], category=category,
                        position=ppos, body=body,
                    )  # fmt: skip
                    note("doc_pages", True)
                    continue
                old = legacy.get(page["slug"])
                if existing.deleted_at or not old or existing.draft_body:
                    continue  # trashed by you, never seeded before, or mid-edit: leave alone
                changed = False
                if any(same_text(existing.body, b) for b in old["bodies"]) and not same_text(
                    existing.body, body
                ):
                    existing.body, existing.title = body, page["title"]
                    changed = True
                    note("doc_pages_updated", True)
                if existing.position == old["position"] and existing.position != ppos:
                    existing.position = ppos  # still where the seed put it, so move it
                    changed = True
                if changed:
                    existing.save()

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

        self.seed_docs(note)

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
