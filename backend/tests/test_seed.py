import pytest
from django.core.management import call_command

from apps.docs.models import DocCategory, DocPage
from apps.project.models import Decision, PipelineStage
from apps.proteins.models import Protein
from apps.synthesis.models import Requirement

pytestmark = pytest.mark.django_db


def counts():
    return (
        Protein.all_objects.count(),
        PipelineStage.all_objects.count(),
        Decision.all_objects.count(),
        DocPage.all_objects.count(),
        Requirement.all_objects.count(),
    )


def test_seed_idempotent():
    call_command("seed", verbosity=0)
    first = counts()
    call_command("seed", verbosity=0)
    assert counts() == first == (16, 13, 5, 10, 5)


def test_seed_preserves_user_edits():
    call_command("seed", verbosity=0)
    p = DocPage.objects.get(slug="research-question")
    p.body = "mine"
    p.save()
    call_command("seed", verbosity=0)
    p.refresh_from_db()
    assert p.body == "mine"


def test_seed_content_matches_spec():
    call_command("seed", verbosity=0)
    nfl = Protein.objects.get(name="NfL")
    assert (nfl.role, nfl.olink_assay_name) == ("comparator", "NEFL")
    assert Protein.objects.get(name="GFAP").role == "comparator"
    assert Protein.objects.get(name="MCP-1").aliases == ["CCL2"]
    assert Protein.objects.filter(role="candidate").count() == 14
    assert all(d.prespecified for d in Decision.objects.all())
    assert set(PipelineStage.objects.values_list("status", flat=True)) == {"not_started"}


# ---- moving an older seeded sidebar to the new one ----
def build_old_seed():
    """The sidebar the first version of the seed created (what an already-deployed site has)."""
    import json
    from pathlib import Path

    from django.conf import settings

    legacy = json.loads((Path(settings.BASE_DIR) / "fixtures/seed/legacy_seed.json").read_text())
    cats = {}
    for i, c in enumerate(legacy.pop("_categories")):
        cats[c["title"]] = DocCategory.objects.create(title=c["title"], position=i)
    for slug, old in legacy.items():
        DocPage.objects.create(
            title=slug.replace("-", " ").title(), slug=slug, category=cats[old["category"]],
            position=old["position"], body=old["bodies"][0],
        )  # fmt: skip
    return legacy


def test_new_seed_replaces_untouched_old_pages_and_keeps_edited_ones():
    legacy = build_old_seed()
    assert DocPage.objects.count() == 14
    mine = DocPage.objects.get(slug="lit-introduction")
    mine.body = "My own introduction, written by me."
    mine.save()

    call_command("seed", verbosity=0)

    live = set(DocPage.objects.values_list("slug", flat=True))
    # untouched old stubs are gone from the sidebar, but recoverable from the Trash
    for slug in (
        "intended-contributions",
        "lit-synthesis-gap",
        "methods-biomarkers",
        "methods-performance",
    ):
        assert slug not in live
        assert DocPage.all_objects.get(slug=slug).deleted_at is not None
    # the page I edited is kept, exactly as I wrote it
    kept = DocPage.objects.get(slug="lit-introduction")
    assert kept.body == "My own introduction, written by me."
    # the new pages exist, and the old categories were renamed (not duplicated)
    assert {
        "where-things-stand",
        "reading-plan",
        "planned-analysis",
        "next-steps",
        "glossary",
    } <= live
    titles = list(
        DocCategory.objects.filter(parent=None).order_by("position").values_list("title", flat=True)
    )
    assert titles == ["Start here", "Reading", "Analysis plan (draft)", "Project"]
    assert DocCategory.objects.count() == 4
    # untouched pages that are still wanted got the new text
    rq = DocPage.objects.get(slug="research-question")
    assert "Early stage" in rq.body and rq.category.title == "Start here"
    assert "Early stage" not in legacy["research-question"]["bodies"][0]
    assert "Ctrl K" in DocPage.objects.get(slug="how-to-use").body
    # ordering inside Project: next steps, data policy, how to use
    project = DocCategory.objects.get(slug="project")
    order = list(project.pages.order_by("position", "title").values_list("slug", flat=True))
    assert order == ["next-steps", "data-policy", "how-to-use"]


def test_old_seed_migration_is_idempotent_and_adds_no_history():
    build_old_seed()
    call_command("seed", verbosity=0)
    before = {p.slug: (p.body, p.position, p.history.count()) for p in DocPage.all_objects.all()}
    cats_before = DocCategory.all_objects.count()
    call_command("seed", verbosity=0)
    after = {p.slug: (p.body, p.position, p.history.count()) for p in DocPage.all_objects.all()}
    assert after == before and DocCategory.all_objects.count() == cats_before


def test_trashed_seed_pages_are_not_brought_back():
    call_command("seed", verbosity=0)
    DocPage.objects.get(slug="glossary").delete()
    call_command("seed", verbosity=0)
    assert not DocPage.objects.filter(slug="glossary").exists()


def test_page_being_edited_is_not_overwritten_by_the_seed():
    build_old_seed()
    page = DocPage.objects.get(slug="how-to-use")
    page.draft_body = "half-written new version"
    page.save()
    call_command("seed", verbosity=0)
    page.refresh_from_db()
    assert page.draft_body == "half-written new version" and "Ctrl K" not in page.body
