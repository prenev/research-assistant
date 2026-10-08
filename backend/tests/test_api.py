import pytest
from django.core.management import call_command

from apps.core.models import SiteSettings
from apps.docs.models import DocCategory, DocPage
from apps.literature.models import Finding, Paper
from apps.project.models import PipelineStage
from apps.proteins.models import Protein

pytestmark = pytest.mark.django_db
API = "/api/v1"


def make_paper(**kw):
    d = dict(title="T", first_author_surname="Smith", year=2024)
    d.update(kw)
    return Paper.objects.create(**d)


# ---- permissions ----
def test_read_requires_login_by_default(anon):
    assert anon.get(f"{API}/papers/").status_code == 403


def test_public_read_allows_get_but_not_write(anon):
    s = SiteSettings.load()
    s.public_read = True
    s.save()
    assert anon.get(f"{API}/papers/").status_code == 200
    assert anon.post(f"{API}/papers/", {"title": "x"}, format="json").status_code == 403


def test_login_logout_me(anon, user):
    r = anon.post(
        f"{API}/auth/login/", {"username": "owner", "password": "pw-12345-long"}, format="json"
    )
    assert r.status_code == 200
    assert anon.get(f"{API}/me/").json()["authenticated"] is True
    assert anon.post(f"{API}/auth/logout/").status_code == 204
    assert anon.get(f"{API}/me/").json()["authenticated"] is False


def test_bad_login(anon, user):
    r = anon.post(f"{API}/auth/login/", {"username": "owner", "password": "no"}, format="json")
    assert r.status_code == 400


# ---- papers / filters ----
def test_paper_crud_and_slug(client):
    r = client.post(
        f"{API}/papers/",
        {"title": "A", "first_author_surname": "Malpetti", "year": 2025},
        format="json",
    )
    assert r.status_code == 201
    assert r.json()["slug"] == "malpetti-2025"
    assert r.json()["short_label"] == "Malpetti 2025"


def test_duplicate_doi_rejected_case_insensitive(client):
    make_paper(doi="10.1/abc")
    r = client.post(f"{API}/papers/", {"title": "B", "doi": "10.1/ABC"}, format="json")
    assert r.status_code == 400 and "doi" in r.json()


def test_blank_doi_stored_as_null_twice(client):
    for _ in range(2):
        assert (
            client.post(f"{API}/papers/", {"title": "B", "doi": ""}, format="json").status_code
            == 201
        )


def test_invalid_fluid_rejected(client):
    r = client.post(f"{API}/papers/", {"title": "B", "fluids": ["saliva"]}, format="json")
    assert r.status_code == 400


def test_filters(client):
    tnf = Protein.objects.create(name="TNF-α")
    a = make_paper(population="general_population", design="prediction", fluids=["plasma"])
    b = make_paper(first_author_surname="Jones", population="genetic_ftd", fluids=["csf"])
    Finding.objects.create(paper=a, protein=tnf, direction="predictive")
    ids = lambda q: {p["id"] for p in client.get(f"{API}/papers/?{q}").json()["results"]}  # noqa: E731
    assert ids("population=general_population") == {a.id}
    assert ids("fluid=csf") == {b.id}
    assert ids(f"protein={tnf.slug}") == {a.id}
    assert ids("population=general_population&design=prediction") == {a.id}


def test_finding_filters_and_counts(client):
    p = make_paper()
    il6 = Protein.objects.create(name="IL-6")
    Finding.objects.create(paper=p, protein=il6, direction="raised", context="ftd_vs_other_disease")
    r = client.get(f"{API}/findings/?protein=il-6&direction=raised").json()["results"]
    assert len(r) == 1 and r[0]["paper_label"] == "Smith 2024"
    assert client.get(f"{API}/proteins/?slug=il-6").json()["results"][0]["finding_count"] == 1


# ---- soft delete + history ----
def test_delete_is_soft_and_hidden(client):
    p = make_paper()
    assert client.delete(f"{API}/papers/{p.id}/").status_code == 204
    assert client.get(f"{API}/papers/{p.id}/").status_code == 404
    assert Paper.all_objects.get(pk=p.id).deleted_at is not None


def test_deleted_paper_hides_its_findings(client):
    p = make_paper()
    Finding.objects.create(paper=p, protein=Protein.objects.create(name="X"), direction="raised")
    p.delete()
    assert client.get(f"{API}/findings/").json()["count"] == 0


def test_history_and_restore(client):
    cat = DocCategory.objects.create(title="C")
    page = DocPage.objects.create(title="P", category=cat, body="v1")
    client.patch(f"{API}/doc-pages/{page.id}/", {"body": "v2"}, format="json")
    hist = client.get(f"{API}/doc-pages/{page.id}/history/").json()
    assert len(hist) == 2
    assert hist[0]["user"] == "owner"
    assert any(c["field"] == "body" and c["new"] == "v2" for c in hist[0]["changes"])
    old = hist[-1]["history_id"]
    r = client.post(f"{API}/doc-pages/{page.id}/restore/{old}/")
    assert r.status_code == 200 and r.json()["body"] == "v1"
    page.refresh_from_db()
    assert page.body == "v1"


# ---- results validation (data policy) ----
def test_low_event_count_requires_confirmation(client):
    body = {
        "title": "r",
        "model_label": "M3",
        "metric": "delta_auc",
        "value": "0.02",
        "n_events": 4,
    }
    r = client.post(f"{API}/results/", body, format="json")
    assert r.status_code == 400 and "confirmed_permitted" in r.json()
    assert (
        client.post(
            f"{API}/results/", {**body, "confirmed_permitted": True}, format="json"
        ).status_code
        == 201
    )
    assert (
        client.post(f"{API}/results/", {**body, "n_events": 50}, format="json").status_code == 201
    )


def test_min_event_threshold_is_configurable(client):
    s = SiteSettings.load()
    s.min_event_count_warning = 100
    s.save()
    body = {"title": "r", "model_label": "M1", "metric": "c_index", "value": "0.7", "n_events": 50}
    assert client.post(f"{API}/results/", body, format="json").status_code == 400


def test_ci_order_validated(client):
    body = {
        "title": "r",
        "model_label": "M1",
        "metric": "c_index",
        "value": "0.7",
        "ci_lower": "0.9",
        "ci_upper": "0.5",
    }
    assert client.post(f"{API}/results/", body, format="json").status_code == 400


# ---- pipeline ----
def test_stage_dates_follow_status(client):
    s = PipelineStage.objects.create(title="S")
    client.patch(f"{API}/pipeline-stages/{s.id}/", {"status": "done"}, format="json")
    s.refresh_from_db()
    assert s.completed_on is not None
    client.patch(f"{API}/pipeline-stages/{s.id}/", {"status": "in_progress"}, format="json")
    s.refresh_from_db()
    assert s.completed_on is None


# ---- sidebar / stats / search ----
def test_sidebar_and_reorder(client):
    a = DocCategory.objects.create(title="A", position=0)
    b = DocCategory.objects.create(title="B", position=1)
    p = DocPage.objects.create(title="P", category=a)
    tree = client.get(f"{API}/sidebar/").json()
    assert [c["title"] for c in tree] == ["A", "B"]
    r = client.post(
        f"{API}/sidebar/reorder/",
        {
            "items": [
                {"type": "page", "id": p.id, "parent": b.id, "position": 0},
                {"type": "category", "id": b.id, "parent": None, "position": 0},
                {"type": "category", "id": a.id, "parent": None, "position": 1},
            ]
        },
        format="json",
    )
    tree = r.json()
    assert [c["title"] for c in tree] == ["B", "A"]
    assert tree[0]["items"][0]["title"] == "P"


def test_reorder_validation(client):
    a = DocCategory.objects.create(title="A")
    r = client.post(
        f"{API}/sidebar/reorder/",
        {"items": [{"type": "page", "id": 1, "parent": None, "position": 0}]},
        format="json",
    )
    assert r.status_code == 400
    r = client.post(
        f"{API}/sidebar/reorder/",
        {"items": [{"type": "category", "id": a.id, "parent": a.id, "position": 0}]},
        format="json",
    )
    assert r.status_code == 400


def test_category_cycle_rejected(client):
    a = DocCategory.objects.create(title="A")
    b = DocCategory.objects.create(title="B", parent=a)
    r = client.patch(f"{API}/doc-categories/{a.id}/", {"parent": b.id}, format="json")
    assert r.status_code == 400


def test_stats_and_search_index(client):
    call_command("seed", verbosity=0)
    stats = client.get(f"{API}/stats/").json()
    assert (
        stats["proteins"] == 16
        and stats["pipeline_stages"] == 13
        and stats["pipeline_progress_pct"] == 0
    )
    types = {i["type"] for i in client.get(f"{API}/search-index/").json()}
    assert {"docs", "proteins", "log", "decisions"} <= types


def test_log_post_auto_summary(client):
    r = client.post(
        f"{API}/log-posts/",
        {"title": "T", "body": "First para.\n\nSecond.\n<!-- truncate -->\nrest"},
        format="json",
    )
    assert r.status_code == 201 and r.json()["summary"] == "First para."


def test_assessment_unique(client):
    call_command("seed", verbosity=0)
    from apps.synthesis.models import Requirement

    p = make_paper()
    req = Requirement.objects.get(number=1)
    body = {"paper": p.id, "requirement": req.id, "met": "yes"}
    assert client.post(f"{API}/requirement-assessments/", body, format="json").status_code == 201
    assert client.post(f"{API}/requirement-assessments/", body, format="json").status_code == 400


def test_openapi_lists_endpoints(client):
    r = client.get("/api/schema/", HTTP_ACCEPT="application/vnd.oai.openapi+json")
    assert r.status_code == 200
    for frag in ("papers", "proteins", "findings", "doc-pages", "log-posts", "results", "sidebar"):
        assert frag in r.content.decode()
