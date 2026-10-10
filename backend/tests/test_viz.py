from datetime import date, timedelta

import pytest
from django.utils import timezone

from apps.core.models import SiteSettings
from apps.journal.models import LogPost
from apps.literature.models import Finding, Paper
from apps.project.models import PipelineStage
from apps.proteins.models import Protein
from apps.synthesis.models import Requirement, RequirementAssessment

pytestmark = pytest.mark.django_db
API = "/api/v1/viz"


def paper(label="A", year=2024, **kw):
    kw.setdefault("title", f"Paper {label}")
    return Paper.objects.create(first_author_surname=label, year=year, **kw)


def finding(p, pr, direction="raised", **kw):
    return Finding.objects.create(paper=p, protein=pr, direction=direction, **kw)


# ---- evidence matrix ----
def test_matrix_shape_and_filters(client):
    tnf, il6, idle = (Protein.objects.create(name=n) for n in ("TNF-α", "IL-6", "Idle"))
    a = paper("A", population="general_population", design="prediction", citation_number=2)
    b = paper("B", population="genetic_ftd", design="cross_sectional", citation_number=1)
    finding(a, tnf, "predictive", effect="AUC 0.72")
    finding(a, il6, "raised")
    finding(b, il6, "raised")
    finding(b, il6, "no_difference")
    r = client.get(f"{API}/evidence-matrix/").json()
    assert [p["name"] for p in r["proteins"]] == ["IL-6", "TNF-α"]  # only proteins with findings
    assert [p["label"] for p in r["papers"]] == ["B 2024", "A 2024"]  # by citation number
    il = next(p for p in r["proteins"] if p["name"] == "IL-6")
    assert (il["findings"], il["papers"], il["top_direction"], il["agreement"]) == (
        3,
        2,
        "raised",
        0.67,
    )
    assert len(r["cells"]) == 4 and any(c["effect"] == "AUC 0.72" for c in r["cells"])
    only = client.get(f"{API}/evidence-matrix/?population=general_population").json()
    assert {p["name"] for p in only["proteins"]} == {"TNF-α", "IL-6"} and len(only["papers"]) == 1
    assert len(client.get(f"{API}/evidence-matrix/?direction=predictive").json()["cells"]) == 1
    empty = client.get(f"{API}/evidence-matrix/?include_empty=1").json()
    assert "Idle" in [p["name"] for p in empty["proteins"]]


def test_matrix_ignores_deleted_items(client):
    p, pr = paper(), Protein.objects.create(name="X")
    finding(p, pr)
    p.delete()
    assert client.get(f"{API}/evidence-matrix/").json()["cells"] == []


# ---- gap map ----
def test_gap_map_places_papers_and_flags_the_target(client):
    paper("A", population="general_population", design="prediction")
    paper("B", population="general_population", design="population_cohort")
    paper("C", population="sporadic_ftd", design="cross_sectional")
    paper("D", population="sporadic_ftd", design="systematic_review")  # no study-type column
    paper("E", population="other", design="prediction")  # no population row
    r = client.get(f"{API}/gap-map/").json()

    def cell(pop, col):
        return next(c for c in r["cells"] if (c["population"], c["column"]) == (pop, col))

    assert cell("general_population", "prediction")["count"] == 2
    assert cell("general_population", "prediction")["is_target"] is True
    assert cell("sporadic_ftd", "cross_sectional")["count"] == 1
    assert cell("genetic_ftd", "longitudinal")["count"] == 0  # a gap
    assert {p["label"] for p in r["unplaced"]} == {"D 2024", "E 2024"}
    assert len(r["cells"]) == 12 and r["mode"] == "papers"


def test_gap_map_can_count_findings_for_one_protein(client):
    tnf, il6 = Protein.objects.create(name="TNF-α"), Protein.objects.create(name="IL-6")
    a = paper("A", population="genetic_ftd", design="longitudinal")
    finding(a, tnf)
    finding(a, tnf, "lowered")
    finding(a, il6)
    r = client.get(f"{API}/gap-map/?protein=tnf-alpha").json()
    c = next(
        c for c in r["cells"] if (c["population"], c["column"]) == ("genetic_ftd", "longitudinal")
    )
    assert r["mode"] == "findings" and c["count"] == 2 and len(c["papers"]) == 1


# ---- network ----
def test_network_degrees_and_mixed_edges(client):
    tnf, il6 = Protein.objects.create(name="TNF-α"), Protein.objects.create(name="IL-6")
    a, b = paper("A"), paper("B")
    finding(a, tnf, "raised")
    finding(a, tnf, "lowered")  # same pair, conflicting directions
    finding(a, il6)
    finding(b, tnf)
    r = client.get(f"{API}/network/").json()
    node = {n["id"]: n for n in r["nodes"]}
    assert node["protein:tnf-alpha"]["degree"] == 2 and node["paper:a-2024"]["degree"] == 2
    edge = next(
        e
        for e in r["edges"]
        if e["source"] == "protein:tnf-alpha" and e["target"] == "paper:a-2024"
    )
    assert edge["direction"] == "mixed" and edge["count"] == 2


# ---- timeline ----
def test_timeline_separates_undated_papers(client):
    paper("A", year=2020, sample_size=50, population="genetic_ftd")
    paper("B", year=2020)
    paper("C", year=None)
    r = client.get(f"{API}/timeline/").json()
    assert len(r["papers"]) == 2 and len(r["undated"]) == 1
    assert r["per_year"] == [{"year": 2020, "count": 2}]
    assert len(client.get(f"{API}/timeline/?population=genetic_ftd").json()["papers"]) == 1


# ---- evidence chain ----
def test_evidence_chain_summary_finds_nobody_meeting_all_five(client):
    reqs = [Requirement.objects.create(number=i, title=f"R{i}") for i in range(1, 6)]
    a, b = paper("A"), paper("B")
    for r in reqs:
        RequirementAssessment.objects.create(
            paper=a, requirement=r, met="yes" if r.number < 5 else "partial"
        )
    r = client.get(f"{API}/evidence-chain/").json()
    assert r["any_meets_all"] is False and r["meets_all"] == []
    t = next(x for x in r["totals"] if x["requirement"] == reqs[0].id)
    assert (t["yes"], t["unset"]) == (1, 1)
    RequirementAssessment.objects.filter(paper=a, requirement=reqs[4]).update(met="yes")
    r = client.get(f"{API}/evidence-chain/").json()
    assert r["any_meets_all"] is True and r["meets_all"][0]["label"] == "A 2024"
    assert b.id in {p["id"] for p in r["papers"]}


# ---- dashboard ----
def test_dashboard_activity_and_streak(client):
    p = paper()
    d = client.get(f"{API}/dashboard/").json()
    today = timezone.localdate()
    assert str(today) in {a["date"] for a in d["activity"]}
    assert d["streak"]["current"] >= 1 and d["streak"]["at_risk"] is False
    assert d["reading"]["total"] == 1 and d["reading"]["to_read"] == 1
    p.reading_status = "read"
    p.save()
    d = client.get(f"{API}/dashboard/").json()
    assert d["week"]["finished"] == 1 and d["reading"]["read"] == 1


def test_streak_logic_with_gaps_and_grace_for_today():
    from apps.core.viz import streaks

    today = date(2026, 3, 10)
    days = lambda *offsets: {today - timedelta(days=o): 1 for o in offsets}  # noqa: E731
    assert streaks(days(0, 1, 2, 5), today) == (3, 3, False)
    assert streaks(days(1, 2, 3), today) == (3, 3, True)  # nothing yet today: streak is at risk
    assert streaks(days(2, 3), today) == (0, 2, False)  # broken
    assert streaks({}, today) == (0, 0, False)


def test_weekly_goal_counts_papers_finished_this_week_only_once(client):
    s = SiteSettings.load()
    s.weekly_reading_goal = 2
    s.save()
    p = paper()
    p.reading_status = "reading"
    p.save()
    p.reading_status = "read"
    p.save()
    p.reading_status = "cited"  # read -> cited is not a second paper finished
    p.save()
    d = client.get(f"{API}/dashboard/").json()
    assert d["week"]["goal"] == 2 and d["week"]["finished"] == 1


def test_next_actions_react_to_the_data(client):
    kinds = lambda: [a["kind"] for a in client.get(f"{API}/dashboard/").json()["next_actions"]]  # noqa: E731
    assert kinds()[0] == "papers"  # nothing yet
    a = paper("A", relevance="core", reading_status="to_read")
    pr = Protein.objects.create(name="TNF-α", role="candidate")
    ks = kinds()
    assert {"reading", "evidence", "rationale", "gap"} <= set(ks) and "papers" not in ks
    a.reading_status = "read"
    a.save()
    finding(a, pr)
    ks = kinds()
    assert "evidence" not in ks and "reading" not in ks
    PipelineStage.objects.create(title="Event audit", status="in_progress")
    acts = client.get(f"{API}/dashboard/").json()["next_actions"]
    assert any(x["kind"] == "pipeline" and "Event audit" in x["title"] for x in acts)
    assert len(acts) <= 6


def test_log_nudge_disappears_after_a_recent_post(client):
    paper()
    assert "log" in [a["kind"] for a in client.get(f"{API}/dashboard/").json()["next_actions"]]
    LogPost.objects.create(title="Today", date=timezone.localdate())
    assert "log" not in [a["kind"] for a in client.get(f"{API}/dashboard/").json()["next_actions"]]


def test_milestones_progress(client):
    for i in range(10):
        paper(f"P{i}", year=2020 + i)
    m = {x["key"]: x for x in client.get(f"{API}/dashboard/").json()["milestones"]}
    assert (
        m["papers10"]["done"] is True and m["read5"]["current"] == 0 and m["read5"]["done"] is False
    )
    assert m["gap"]["done"] is False


def test_viz_endpoints_need_login(anon):
    for name in (
        "evidence-matrix",
        "gap-map",
        "network",
        "timeline",
        "evidence-chain",
        "dashboard",
    ):
        assert anon.get(f"{API}/{name}/").status_code == 403


# ---- fake data generator ----
def test_fake_data_is_marked_separate_and_removable(client):
    from django.core.management import call_command
    from django.core.management.base import CommandError

    call_command("seed", verbosity=0)
    real = (Paper.objects.count(), Protein.objects.count(), Finding.objects.count())
    with pytest.raises(CommandError):
        call_command("seed_fake")  # needs --yes
    call_command("seed_fake", papers=40, proteins=25, findings=120, yes=True, verbosity=0)
    assert Paper.objects.filter(title__startswith="[FAKE]").count() == 40
    assert Paper.objects.filter(tags__slug="fake-data").count() == 40
    assert Protein.objects.filter(name__startswith="FAKE-P").count() == 25
    assert Finding.objects.filter(notes="FAKE").count() == 120
    assert (
        Paper.objects.exclude(title__startswith="[FAKE]").count() == real[0]
    )  # real data untouched
    assert Paper.history.model.objects.count() == 0  # no activity history, so no fake streak
    with pytest.raises(CommandError):
        call_command("seed_fake", yes=True)  # not twice
    # charts handle it
    m = client.get(f"{API}/evidence-matrix/").json()
    assert len(m["cells"]) == 120
    call_command("purge_fake", verbosity=0)
    assert (Paper.objects.count(), Protein.objects.count(), Finding.objects.count()) == real
    assert not Paper.all_objects.filter(title__startswith="[FAKE]").exists()
