import pytest

from apps.docs.models import DocCategory, DocPage
from apps.journal.models import LogPost
from apps.literature.models import Paper, Tag
from apps.project.models import Decision
from apps.proteins.models import Protein

pytestmark = pytest.mark.django_db
API = "/api/v1"


def doc(title, body="", **kw):
    cat, _ = DocCategory.objects.get_or_create(title="Notes")
    return DocPage.objects.create(title=title, body=body, category=cat, **kw)


# ---- tags ----
def test_new_tags_get_a_stable_colour_and_can_be_recoloured(client):
    r = client.post(f"{API}/tags/", {"name": "Methods"}, format="json").json()
    assert r["colour"].startswith("#") and len(r["colour"]) == 7
    again = client.post(f"{API}/tags/", {"name": "Other"}, format="json").json()
    assert Tag.objects.get(pk=again["id"]).colour
    r = client.patch(f"{API}/tags/{r['id']}/", {"colour": "#112233"}, format="json").json()
    assert r["colour"] == "#112233"
    bad = client.patch(f"{API}/tags/{r['id']}/", {"colour": "red"}, format="json")
    assert bad.status_code == 400


def test_tag_names_are_unique_ignoring_case_and_hash(client):
    client.post(f"{API}/tags/", {"name": "Plasma"}, format="json")
    r = client.post(f"{API}/tags/", {"name": "#plasma"}, format="json")
    assert r.status_code == 400


def test_tags_work_on_every_kind_of_item_and_are_counted(client):
    t = Tag.objects.create(name="Core")
    p = Paper.objects.create(title="P", first_author_surname="A", year=2020)
    pr = Protein.objects.create(name="GFAP")
    d = Decision.objects.create(title="D")
    page = doc("Page")
    post = LogPost.objects.create(title="Post")
    for obj in (p, pr, d, page, post):
        obj.tags.add(t)
    # tags can also be set through the API for proteins and decisions
    r = client.patch(f"{API}/proteins/{pr.pk}/", {"tags": [t.pk]}, format="json")
    assert r.status_code == 200 and r.json()["tags"] == [t.pk]
    r = client.patch(f"{API}/decisions/{d.pk}/", {"tags": [t.pk]}, format="json")
    assert r.status_code == 200
    data = client.get(f"{API}/tags/").json()["results"][0]
    assert data["counts"] == {"papers": 1, "proteins": 1, "docs": 1, "log": 1, "decisions": 1}
    assert data["total"] == 5


def test_deleted_items_are_not_counted(client):
    t = Tag.objects.create(name="Core")
    p = Paper.objects.create(title="P", first_author_surname="A", year=2020)
    p.tags.add(t)
    p.delete()
    assert client.get(f"{API}/tags/").json()["results"][0]["total"] == 0


def test_merge_moves_everything_and_removes_the_source(client):
    a, b = Tag.objects.create(name="A"), Tag.objects.create(name="B")
    p = Paper.objects.create(title="P", first_author_surname="A", year=2020)
    p.tags.add(a)
    r = client.post(f"{API}/tags/{a.pk}/merge/", {"into": b.pk}, format="json")
    assert r.status_code == 200 and r.json()["total"] == 1
    assert list(p.tags.all()) == [b]
    assert not Tag.objects.filter(pk=a.pk).exists()
    assert (
        client.post(f"{API}/tags/{b.pk}/merge/", {"into": b.pk}, format="json").status_code == 400
    )
    assert client.post(f"{API}/tags/{b.pk}/merge/", {}, format="json").status_code == 400


def test_tag_items_requires_all_tags(client):
    a, b = Tag.objects.create(name="A"), Tag.objects.create(name="B")
    both, only_a = doc("Both"), doc("Only A")
    both.tags.add(a, b)
    only_a.tags.add(a)
    pr = Protein.objects.create(name="Prot")
    pr.tags.add(a, b)
    one = client.get(f"{API}/tag-items/?tags={a.slug}").json()
    assert {i["title"] for i in one["items"]} == {"Both", "Only A", "Prot"}
    two = client.get(f"{API}/tag-items/?tags={a.slug},{b.slug}").json()
    assert {i["title"] for i in two["items"]} == {"Both", "Prot"}
    assert [t["slug"] for t in two["tags"]] == [a.slug, b.slug]
    assert client.get(f"{API}/tag-items/?tags=nope").json() == {"tags": [], "items": []}


# ---- links ----
def test_wikilinks_resolve_by_title_alias_and_label(client):
    target = doc("Cohort definition")
    doc(
        "Plan",
        "See [[cohort definition]] and [[Cohort definition|the cohort]] and [[Nothing here]].",
    )
    pr = Protein.objects.create(name="GFAP", aliases=["Glial fibrillary acidic protein"])
    doc("Proteins", "Look at [[Glial fibrillary acidic protein]].")
    g = client.get(f"{API}/links/graph/").json()
    pairs = {(e["source"], e["target"]) for e in g["edges"]}
    assert ("/docs/plan", f"/docs/{target.slug}") in pairs
    assert ("/docs/proteins", f"/proteins/{pr.slug}") in pairs
    assert [w["title"] for w in g["wanted"]] == ["Nothing here"]
    assert g["wanted"][0]["from"][0]["url"] == "/docs/plan"


def test_links_in_code_are_ignored_and_shortcodes_count(client):
    doc("Target")
    paper = Paper.objects.create(
        title="Paper X", first_author_surname="Xu", year=2021, citation_number=7
    )
    doc("Src", f"`[[Target]]`\n\n```\n[[Target]]\n```\n\n{{{{cite:7}}}} {{{{paper:{paper.slug}}}}}")
    g = client.get(f"{API}/links/graph/").json()
    targets = {e["target"] for e in g["edges"] if e["source"] == "/docs/src"}
    assert targets == {f"/papers/{paper.slug}"}


def test_log_posts_link_through_their_sidebar_relations(client):
    paper = Paper.objects.create(title="Paper X", first_author_surname="Xu", year=2021)
    post = LogPost.objects.create(title="Reading")
    post.linked_papers.add(paper)
    g = client.get(f"{API}/links/graph/").json()
    assert any(
        e["source"] == f"/log/{post.slug}" and e["target"] == f"/papers/{paper.slug}"
        for e in g["edges"]
    )


def test_backlinks_outgoing_and_unlinked_mentions(client):
    target = doc("Event audit", "Details.")
    doc("Plan", "First do the [[Event audit]] properly.")
    doc("Idea", "We should run the event audit again.")
    doc("Unrelated", "Nothing.")
    r = client.get(f"{API}/links/backlinks/", {"url": f"/docs/{target.slug}"}).json()
    assert [x["title"] for x in r["incoming"]] == ["Plan"]
    assert "Event audit" in r["incoming"][0]["snippet"]
    assert [x["title"] for x in r["mentions"]] == ["Idea"]
    out = client.get(f"{API}/links/backlinks/", {"url": "/docs/plan"}).json()
    assert [x["title"] for x in out["outgoing"]] == ["Event audit"]
    assert client.get(f"{API}/links/backlinks/", {"url": "/docs/missing"}).json()["incoming"] == []


def test_orphans_are_notes_with_no_links_and_graph_carries_tags(client):
    t = Tag.objects.create(name="Idea")
    a = doc("Linked", "[[Other]]")
    doc("Other")
    lone = doc("Lonely")
    lone.tags.add(t)
    g = client.get(f"{API}/links/graph/").json()
    assert [o["title"] for o in g["orphans"]] == ["Lonely"]
    node = next(n for n in g["nodes"] if n["title"] == "Lonely")
    assert node["tags"][0]["name"] == "Idea" and node["tags"][0]["colour"]
    assert next(n for n in g["nodes"] if n["title"] == "Linked")["degree"] == 1 and a


def test_link_index_lists_names_for_the_picker(client):
    doc("Cohort definition")
    Protein.objects.create(name="NfL", aliases=["Neurofilament light"])
    idx = client.get(f"{API}/links/index/").json()
    nfl = next(i for i in idx if i["title"] == "NfL")
    assert "Neurofilament light" in nfl["aliases"] and nfl["type"] == "proteins"


def test_endpoints_need_login(anon):
    for url in ("links/graph/", "links/index/", "links/backlinks/", "tag-items/"):
        assert anon.get(f"{API}/{url}").status_code in (401, 403)


def test_dashboard_nudges_towards_linking_notes(client):
    doc("Plan", "See [[A page nobody wrote]].")
    doc("Lonely", "Some thoughts.")
    kinds = {a["kind"] for a in client.get(f"{API}/viz/dashboard/").json()["next_actions"]}
    assert {"wanted", "connect"} <= kinds
    ms = {m["key"]: m for m in client.get(f"{API}/viz/dashboard/").json()["milestones"]}
    assert ms["tags5"]["current"] == 0 and not ms["links10"]["done"]
