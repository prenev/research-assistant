"""Wikipedia lookups are tested with a fake client: tests never touch the network."""

from types import SimpleNamespace

import pytest
import wikipediaapi
from django.core.cache import cache

from apps.proteins import wiki
from apps.proteins.models import Protein

pytestmark = pytest.mark.django_db
API = "/api/v1"


class FakePage:
    def __init__(self, title, summary="A protein.", exists=True, sections=()):
        self.title, self.summary, self._exists = title, summary, exists
        self.sections = [SimpleNamespace(title=t, text=x) for t, x in sections]
        self.fullurl = f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}"

    def exists(self):
        return self._exists


class FakeImage(SimpleNamespace):
    pass


class FakeClient:
    """Mimics the parts of wikipediaapi.Wikipedia that wiki.py uses."""

    def __init__(self, pages, search_hits=None, images=()):
        self.pages = {p.title: p for p in pages}
        self.search_hits = search_hits or {}
        self.image_list = list(images)
        self.searched = []

    def page(self, title):
        return self.pages.get(title, FakePage(title, exists=False))

    def search(self, query, limit=3):
        self.searched.append(query)
        return SimpleNamespace(pages={t: None for t in self.search_hits.get(query, [])})

    def images(self, page, limit=40):
        return {i.title: i for i in self.image_list}

    def batch_imageinfo(self, images):
        return {}


def img(name, mime="image/jpeg", width=600, folder="a/ab"):
    return FakeImage(
        title=f"File:{name}",
        url=f"https://upload.wikimedia.org/wikipedia/commons/{folder}/{name}",
        mime=mime,
        width=width,
        height=400,
    )


@pytest.fixture
def fake(monkeypatch):
    def install(client):
        monkeypatch.setattr(wiki, "get_client", lambda: client)
        return client

    cache.clear()
    return install


# ---- helpers ----
def test_thumb_url_uses_wikimedia_thumb_path():
    u = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Some_protein.jpg"
    assert wiki.thumb_url(u, 480) == (
        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Some_protein.jpg/480px-Some_protein.jpg"
    )
    assert wiki.thumb_url(
        "https://upload.wikimedia.org/wikipedia/commons/c/cd/Fig.svg", 300
    ).endswith("/300px-Fig.svg.png")
    already = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/200px-X.jpg"
    assert wiki.thumb_url(already) == already
    assert wiki.thumb_url("https://example.org/x.jpg") == "https://example.org/x.jpg"


def test_caption_and_disambiguation():
    assert wiki.caption_of("File:Tumor_necrosis_factor_3D.png") == "Tumor necrosis factor 3D"
    assert wiki.is_disambiguation("IL-6 may refer to:")
    assert not wiki.is_disambiguation("Interleukin 6 is a cytokine.")


def test_candidate_queries_dedupes():
    assert wiki.candidate_queries("IL-6", ["IL6", "il-6"]) == [
        "IL-6 protein",
        "IL-6",
        "IL6 protein",
    ]


# ---- article lookup ----
def test_explicit_title_is_used_without_searching(fake):
    c = fake(FakeClient([FakePage("Tumor necrosis factor", "TNF is a cytokine.")]))
    data = wiki.article_for("TNF-α", [], explicit="Tumor necrosis factor")
    assert data["found"] and data["matched_by"] == "explicit"
    assert data["summary"] == "TNF is a cytokine." and c.searched == []
    assert data["license"]["name"] == "CC BY-SA 4.0" and "Wikipedia" in data["attribution"]


def test_search_skips_disambiguation_and_missing_pages(fake):
    fake(
        FakeClient(
            [
                FakePage("IL-6 (disambiguation)", "IL-6 may refer to: something"),
                FakePage("Interleukin 6", "Interleukin 6 is a cytokine."),
            ],
            search_hits={"IL-6 protein": ["Ghost page", "IL-6 (disambiguation)", "Interleukin 6"]},
        )
    )
    data = wiki.article_for("IL-6", [])
    assert data["title"] == "Interleukin 6" and data["matched_by"] == "search"


def test_not_found(fake):
    fake(FakeClient([], search_hits={}))
    assert wiki.article_for("Madeupin", [])["found"] is False
    assert wiki.article_for("X", [], explicit="No such page")["found"] is False


def test_sections_skip_references_and_cap_length(fake):
    long = "word " * 600
    page = FakePage(
        "P",
        sections=[
            ("Function", "Does things."),
            ("References", "ref list"),
            ("Empty", ""),
            ("History", long),
        ],
    )
    secs = wiki.sections_of(page)
    assert [s["title"] for s in secs] == ["Function", "History"]
    assert secs[1]["text"].endswith("…") and len(secs[1]["text"]) < 1600


def test_images_are_filtered_and_resized(fake):
    client = fake(
        FakeClient(
            [FakePage("P")],
            images=[
                img("Structure_of_P.png", "image/png", folder="b/bc"),
                img("Commons-logo.svg", "image/svg+xml"),  # junk by name
                img("Question_book-new.svg", "image/svg+xml"),  # junk by name
                img("Tiny.png", "image/png", width=40),  # too small
                img("Audio.ogg", "audio/ogg"),  # not an image
                img("Pathway.svg", "image/svg+xml", folder="c/cd"),
            ],
        )
    )
    out = wiki.images_of(client, FakePage("P"))
    assert [i["caption"] for i in out] == ["Structure of P", "Pathway"]
    assert out[0]["thumb"].endswith("/480px-Structure_of_P.png") and "/thumb/" in out[0]["thumb"]
    assert out[1]["thumb"].endswith("/480px-Pathway.svg.png")
    assert out[0]["full"].endswith("/1200px-Structure_of_P.png")


# ---- endpoint ----
def test_endpoint_returns_article_and_caches(client, fake):
    c = fake(
        FakeClient(
            [FakePage("Interleukin 6", "IL-6 is a cytokine.")],
            search_hits={"IL-6 protein": ["Interleukin 6"]},
        )
    )
    p = Protein.objects.create(name="IL-6")
    r = client.get(f"{API}/proteins/{p.id}/wikipedia/").json()
    assert r["found"] and r["title"] == "Interleukin 6" and r["summary"] == "IL-6 is a cytokine."
    n = len(c.searched)
    client.get(f"{API}/proteins/{p.id}/wikipedia/")  # served from cache
    assert len(c.searched) == n
    client.get(f"{API}/proteins/{p.id}/wikipedia/?refresh=1")  # refresh bypasses it
    assert len(c.searched) > n


def test_endpoint_uses_the_saved_wikipedia_title(client, fake):
    c = fake(FakeClient([FakePage("Neurofilament light chain", "NfL is a biomarker.")]))
    p = Protein.objects.create(name="NfL", wikipedia_title="Neurofilament light chain")
    r = client.get(f"{API}/proteins/{p.id}/wikipedia/").json()
    assert r["found"] and r["matched_by"] == "explicit" and c.searched == []


def test_endpoint_reports_unreachable_without_caching(client, monkeypatch):
    cache.clear()

    def boom(*a, **k):
        raise wikipediaapi.WikiConnectionError("offline")

    monkeypatch.setattr(wiki, "article_for", boom)
    p = Protein.objects.create(name="GFAP")
    r = client.get(f"{API}/proteins/{p.id}/wikipedia/")
    assert (
        r.status_code == 200 and r.json()["found"] is False and r.json()["error"] == "unreachable"
    )
    monkeypatch.setattr(wiki, "article_for", lambda *a, **k: {"found": True, "title": "GFAP"})
    assert (
        client.get(f"{API}/proteins/{p.id}/wikipedia/").json()["found"] is True
    )  # error was not cached


def test_endpoint_requires_login(anon):
    p = Protein.objects.create(name="GFAP")
    assert anon.get(f"{API}/proteins/{p.id}/wikipedia/").status_code == 403


def test_proteins_with_old_style_slugs_get_wikipedia_info_too(client, fake):
    """Proteins created before slugs spelled out Greek letters (e.g. 'tnf') must work the same."""
    fake(
        FakeClient(
            [FakePage("Tumor necrosis factor", "TNF is a cytokine.")],
            search_hits={"TNF-α protein": ["Tumor necrosis factor"]},
        )
    )
    old = Protein.objects.create(name="TNF-α")
    Protein.objects.filter(pk=old.pk).update(slug="tnf")  # the slug it had before the change
    r = client.get(f"{API}/proteins/{old.id}/wikipedia/").json()
    assert r["found"] and r["title"] == "Tumor necrosis factor"
    assert (
        client.get(f"{API}/proteins/?slug=tnf").json()["results"][0]["id"] == old.id
    )  # old URL still works
