import pytest
from django.core.management import call_command

from apps.docs.models import DocPage
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
    assert counts() == first == (16, 13, 5, 14, 5)


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
