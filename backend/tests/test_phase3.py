import io
import json
from unittest import mock

import pytest
from django.core.management import call_command
from django.test import override_settings
from PIL import Image

from apps.docs.models import DocCategory, DocPage
from apps.literature import citations
from apps.literature.models import Paper

pytestmark = pytest.mark.django_db
API = "/api/v1"

CROSSREF_MSG = {
    "DOI": "10.1000/ABC",
    "title": ["A <i>test</i> paper"],
    "author": [{"given": "Maura", "family": "Malpetti"}, {"given": "Jo-Ann B", "family": "Smith"}],
    "container-title": ["Nature Medicine"],
    "issued": {"date-parts": [[2025, 3]]},
    "volume": "31",
    "issue": "2",
    "page": "100-110",
    "URL": "https://doi.org/10.1000/abc",
}

BIB = """
@article{malpetti2025,
  author = {Malpetti, Maura and Smith, Jo-Ann},
  title = {Plasma {TNF} in FTD},
  journal = {Nature Medicine},
  year = {2025},
  volume = {31},
  pages = {100--110},
  doi = {10.1000/ABC}
}
@book{ignored, title = "Not an article, but parsed", year = 1999}
"""


# ---- citations ----
def test_normalise_doi():
    assert citations.normalise_doi("https://doi.org/10.1/ABC ") == "10.1/abc"
    assert citations.normalise_doi("doi: 10.1/x") == "10.1/x"


def test_crossref_mapping_and_ieee():
    f = citations.paper_fields_from_crossref(CROSSREF_MSG)
    assert f["title"] == "A test paper"
    assert f["authors"] == "M. Malpetti et al."
    assert (f["first_author_surname"], f["year"], f["doi"]) == ("Malpetti", 2025, "10.1000/abc")
    assert f["ieee_reference"].startswith("M. Malpetti and J.-A. B. Smith, “A test paper,”")
    assert "vol. 31, no. 2, pp. 100–110, 2025, doi: 10.1000/abc." in f["ieee_reference"]


def test_ieee_many_authors_uses_et_al():
    meta = {"authors_list": [{"given": f"A{i}", "family": f"F{i}"} for i in range(8)], "title": "T"}
    assert citations.ieee_reference(meta).startswith("A. F0 et al.,")


def test_parse_bibtex():
    entries = citations.parse_bibtex(BIB)
    assert len(entries) == 2
    e = entries[0]
    assert (e["title"], e["year"], e["doi"], e["pages"]) == (
        "Plasma TNF in FTD",
        2025,
        "10.1000/abc",
        "100-110",
    )
    assert e["authors"] == "M. Malpetti et al."
    assert entries[1]["title"].startswith("Not an article")


def test_parse_zotero_csv():
    csv_text = (
        '"Key","Publication Year","Author","Title","Publication Title",'
        '"Volume","Issue","Pages","DOI","Url"\n'
        '"K1","2024","Smith, Jo; Lee, Kim","Hello","J Neuro","3","1","5-9","10.5/Z",""\n'
    )
    [e] = citations.parse_zotero_csv(csv_text)
    assert (e["first_author_surname"], e["year"], e["doi"], e["pages"]) == (
        "Smith",
        2024,
        "10.5/z",
        "5-9",
    )


# ---- DOI lookup endpoint ----
def test_lookup_doi_success_and_duplicate(client):
    with mock.patch.object(citations, "fetch_crossref", return_value=CROSSREF_MSG):
        r = client.post(
            f"{API}/papers/lookup-doi/", {"doi": "https://doi.org/10.1000/ABC"}, format="json"
        ).json()
        assert r["found"] and r["fields"]["title"] == "A test paper" and r["duplicate"] is None
        Paper.objects.create(title="x", doi="10.1000/abc")
        r = client.post(f"{API}/papers/lookup-doi/", {"doi": "10.1000/abc"}, format="json").json()
        assert r["duplicate"]["slug"]


def test_lookup_doi_failures_are_graceful(client):
    with mock.patch.object(
        citations, "fetch_crossref", side_effect=ConnectionError("Could not reach Crossref.")
    ):
        r = client.post(f"{API}/papers/lookup-doi/", {"doi": "10.1/x"}, format="json")
        assert r.status_code == 200 and r.json()["found"] is False and r.json()["manual"] is True
    with mock.patch.object(
        citations, "fetch_crossref", side_effect=LookupError("DOI not found on Crossref.")
    ):
        assert (
            client.post(f"{API}/papers/lookup-doi/", {"doi": "10.1/x"}, format="json").json()[
                "found"
            ]
            is False
        )
    assert client.post(f"{API}/papers/lookup-doi/", {"doi": ""}, format="json").status_code == 400


def test_lookup_requires_login(anon):
    assert (
        anon.post(f"{API}/papers/lookup-doi/", {"doi": "10.1/x"}, format="json").status_code == 403
    )


# ---- import ----
def test_bibtex_preview_flags_duplicates_then_confirm(client):
    Paper.objects.create(title="Existing", doi="10.1000/abc")
    prev = client.post(f"{API}/import/bibtex/", {"text": BIB}, format="json").json()["entries"]
    assert prev[0]["duplicate"] is True and prev[1]["duplicate"] is False
    assert Paper.objects.count() == 1  # preview saves nothing
    r = client.post(f"{API}/import/bibtex/confirm/", {"entries": [prev[1]]}, format="json")
    assert r.status_code == 201 and len(r.json()["created"]) == 1
    # confirming a duplicate is skipped, not created
    r = client.post(f"{API}/import/bibtex/confirm/", {"entries": [prev[0]]}, format="json").json()
    assert r["created"] == [] and r["skipped"]


def test_import_file_upload_and_empty(client):
    f = io.BytesIO(BIB.encode())
    f.name = "refs.bib"
    r = client.post(f"{API}/import/bibtex/", {"file": f}, format="multipart")
    assert r.status_code == 200 and len(r.json()["entries"]) == 2
    assert (
        client.post(f"{API}/import/bibtex/", {"text": "nothing here"}, format="json").status_code
        == 400
    )


def test_zotero_import(client):
    text = '"Publication Year","Author","Title","DOI"\n"2024","Doe, Jan","Zed","10.9/q"\n'
    r = client.post(f"{API}/import/zotero-csv/", {"text": text}, format="json")
    assert r.json()["entries"][0]["title"] == "Zed"


# ---- exports ----
def test_exports(client):
    Paper.objects.create(
        title="B", citation_number=2, first_author_surname="B", year=2020, ieee_reference="REF B."
    )
    Paper.objects.create(
        title="A",
        citation_number=1,
        first_author_surname="A",
        year=2021,
        ieee_reference="REF A.",
        doi="10.1/a",
    )
    ieee = client.get(f"{API}/export/ieee/").content.decode().splitlines()
    assert ieee == ["[1] REF A.", "[2] REF B."]
    bib = client.get(f"{API}/export/bibtex/").content.decode()
    assert bib.count("@article{") == 2 and "doi = {10.1/a}" in bib
    data = json.loads(client.get(f"{API}/export/json/").content)
    assert len(data["papers"]) == 2 and "settings" in data and "proteins" in data


# ---- uploads ----
def png_bytes(fmt="PNG"):
    b = io.BytesIO()
    Image.new("RGB", (4, 4), "red").save(b, fmt)
    b.seek(0)
    return b


def test_image_upload(client, tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        f = png_bytes()
        f.name = "x.png"
        r = client.post(f"{API}/uploads/", {"file": f}, format="multipart")
        assert r.status_code == 201 and r.json()["url"].startswith("/media/uploads/")
        assert list((tmp_path / "uploads").glob("*.png"))


def test_upload_rejects_non_images_and_svg(client, tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        for name, content in [("a.png", b"not an image"), ("a.svg", b"<svg onload='x'/>")]:
            f = io.BytesIO(content)
            f.name = name
            assert (
                client.post(f"{API}/uploads/", {"file": f}, format="multipart").status_code == 400
            )
        assert client.post(f"{API}/uploads/", {}, format="multipart").status_code == 400


def test_upload_requires_login(anon):
    f = png_bytes()
    f.name = "x.png"
    assert anon.post(f"{API}/uploads/", {"file": f}, format="multipart").status_code == 403


# ---- trash ----
def test_trash_list_restore_purge(client):
    p = Paper.objects.create(title="Gone")
    client.delete(f"{API}/papers/{p.id}/")
    items = client.get(f"{API}/trash/").json()
    assert (
        items[0]["type"] == "paper" and items[0]["title"] == "Gone" and items[0]["days_left"] == 30
    )
    assert (
        client.post(f"{API}/trash/", {"type": "paper", "id": p.id}, format="json").status_code
        == 200
    )
    assert client.get(f"{API}/papers/{p.id}/").status_code == 200
    client.delete(f"{API}/papers/{p.id}/")
    assert (
        client.delete(f"{API}/trash/", {"type": "paper", "id": p.id}, format="json").status_code
        == 204
    )
    assert not Paper.all_objects.filter(pk=p.id).exists()


def test_trash_bad_requests(client):
    assert client.post(f"{API}/trash/", {"type": "nope", "id": 1}, format="json").status_code == 400
    assert (
        client.post(f"{API}/trash/", {"type": "paper", "id": 999}, format="json").status_code == 404
    )


# ---- autosave drafts ----
def test_autosave_does_not_pollute_history(client):
    cat = DocCategory.objects.create(title="C")
    page = DocPage.objects.create(title="P", category=cat, body="published")
    for text in ("d1", "d2", "d3"):
        r = client.patch(f"{API}/doc-pages/{page.id}/", {"draft_body": text}, format="json")
        assert r.status_code == 200 and r.json()["has_draft"] is True
    assert len(client.get(f"{API}/doc-pages/{page.id}/history/").json()) == 1
    # publish: body set, draft cleared, one new history row
    client.patch(f"{API}/doc-pages/{page.id}/", {"body": "d3", "draft_body": ""}, format="json")
    page.refresh_from_db()
    assert (page.body, page.draft_body, page.last_edited_by.username) == ("d3", "", "owner")
    assert len(client.get(f"{API}/doc-pages/{page.id}/history/").json()) == 2


# ---- reorder safety ----
def test_category_cannot_move_into_descendant(client):
    a = DocCategory.objects.create(title="A")
    b = DocCategory.objects.create(title="B", parent=a)
    r = client.post(
        f"{API}/sidebar/reorder/",
        {"items": [{"type": "category", "id": a.id, "parent": b.id, "position": 0}]},
        format="json",
    )
    assert r.status_code == 400
    a.refresh_from_db()
    assert a.parent_id is None


def test_pipeline_reorder(client):
    from apps.project.models import PipelineStage

    s = [PipelineStage.objects.create(title=f"S{i}", position=i) for i in range(3)]
    ids = [s[2].id, s[0].id, s[1].id]
    r = client.post(f"{API}/pipeline-stages/reorder/", {"ids": ids}, format="json")
    assert r.status_code == 200
    assert [x["id"] for x in r.json()] == ids
    assert (
        client.post(f"{API}/pipeline-stages/reorder/", {"ids": ids[:2]}, format="json").status_code
        == 400
    )


def test_form_meta_has_choices_and_requires_login(client, anon):
    fields = client.get(f"{API}/form-meta/papers/").json()["fields"]
    assert fields["title"]["required"] is True
    assert {c["value"] for c in fields["design"]["choices"]} >= {"prediction", "cross_sectional"}
    assert "id" in fields and fields["id"]["read_only"] is True
    assert client.get(f"{API}/form-meta/nope/").status_code == 404
    assert anon.get(f"{API}/form-meta/papers/").status_code == 403


# ---- hosting ----
def test_ensure_owner_creates_once_and_keeps_changed_password(monkeypatch):
    from django.contrib.auth import get_user_model

    monkeypatch.setenv("OWNER_USERNAME", "me")
    monkeypatch.setenv("OWNER_PASSWORD", "first-password-123")
    call_command("ensure_owner")
    U = get_user_model()
    u = U.objects.get(username="me")
    assert u.is_superuser and u.check_password("first-password-123")
    u.set_password("changed-later-456")
    u.save()
    call_command("ensure_owner")  # next deploy must not clobber it
    u.refresh_from_db()
    assert u.check_password("changed-later-456")
    monkeypatch.setenv("OWNER_RESET_PASSWORD", "1")
    call_command("ensure_owner")
    u.refresh_from_db()
    assert u.check_password("first-password-123")


def test_ensure_owner_skips_without_env(monkeypatch):
    from django.contrib.auth import get_user_model

    monkeypatch.delenv("OWNER_USERNAME", raising=False)
    call_command("ensure_owner")
    assert not get_user_model().objects.exists()


def test_healthz_and_spa_fallback(anon, tmp_path, settings):
    assert anon.get("/healthz").content == b"ok"
    (tmp_path / "index.html").write_text("<html>app</html>")
    settings.FRONTEND_DIST = tmp_path
    r = anon.get("/docs/some-page")  # a React Router path
    assert r.status_code == 200 and b"app" in r.content
    assert anon.get("/api/v1/nope-not-real/").status_code in (
        403,
        404,
    )  # API paths are not swallowed
    assert b"app" not in anon.get("/api/v1/me/").content
