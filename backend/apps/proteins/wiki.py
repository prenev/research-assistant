"""Background information for a protein from Wikipedia, via the Wikipedia-API package.

Everything is fetched server-side and returned as plain data, so the web app can show it in its own
view (text and images) without sending the reader to Wikipedia. Wikipedia text is CC BY-SA 4.0, so
the response carries the attribution the licence requires.
"""

import re

import wikipediaapi

USER_AGENT = (
    "FTDNotebook/1.0 (personal research notebook; https://github.com/prenev/research-assistant)"
)
LICENSE = {"name": "CC BY-SA 4.0", "url": "https://creativecommons.org/licenses/by-sa/4.0/"}

SKIP_SECTIONS = {
    "see also", "references", "external links", "further reading", "notes", "bibliography",
    "citations", "sources", "footnotes",
}  # fmt: skip
OK_MIME = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"}
JUNK_IMAGE = re.compile(
    r"(icon|logo|symbol|flag|ambox|question[ _]book|commons-|wikidata|wikimedia|wikipedia|portal|"
    r"edit-|padlock|nuvola|crystal|stub|disambig|folder|searchtool|increase|decrease|steady|"
    r"red[ _]pencil|ooui|cc-by|lock-|gnome|mono_|speaker|sound|pubchem|chembox)",
    re.I,
)
MAX_IMAGES = 8


def get_client() -> wikipediaapi.Wikipedia:
    return wikipediaapi.Wikipedia(user_agent=USER_AGENT, language="en")


def thumb_url(url: str, width: int = 480) -> str:
    """Wikimedia serves resized copies under /thumb/. Avoids loading multi-megabyte originals."""
    m = re.match(
        r"^(https://upload\.wikimedia\.org/wikipedia/[^/]+)/((?:[0-9a-f]/[0-9a-f]{2})/([^/]+))$",
        url,
    )
    if not m or "/thumb/" in url:
        return url
    base, path, name = m.groups()
    suffix = ".png" if name.lower().endswith((".svg", ".tif", ".tiff")) else ""
    return f"{base}/thumb/{path}/{width}px-{name}{suffix}"


def caption_of(file_title: str) -> str:
    name = re.sub(r"^File:", "", file_title)
    name = re.sub(r"\.[A-Za-z0-9]+$", "", name)
    return re.sub(r"\s+", " ", name.replace("_", " ")).strip()


def is_disambiguation(summary: str) -> bool:
    return "may refer to" in summary[:300].lower()


def candidate_queries(name: str, aliases: list[str]) -> list[str]:
    qs = [f"{name} protein", name, *[f"{a} protein" for a in aliases[:2]]]
    seen, out = set(), []
    for q in qs:
        if q.lower() not in seen:
            seen.add(q.lower())
            out.append(q)
    return out


def find_page(client, name: str, aliases: list[str], explicit: str = ""):
    """Return (page, how) or (None, None). Explicit titles are trusted; searches skip lists."""
    if explicit.strip():
        page = client.page(explicit.strip())
        return (page, "explicit") if page.exists() else (None, None)
    tried = set()
    for query in candidate_queries(name, aliases):
        results = client.search(query, limit=3)
        for title in list(results.pages.keys()):
            if title in tried:
                continue
            tried.add(title)
            page = client.page(title)
            if page.exists() and not is_disambiguation(page.summary):
                return page, "search"
    return None, None


def sections_of(page, limit: int = 6, max_chars: int = 1500) -> list[dict]:
    out = []
    for sec in page.sections:
        text = (sec.text or "").strip()
        if not text or sec.title.strip().lower() in SKIP_SECTIONS:
            continue
        out.append(
            {"title": sec.title, "text": text[:max_chars] + ("…" if len(text) > max_chars else "")}
        )
        if len(out) == limit:
            break
    return out


def images_of(client, page) -> list[dict]:
    files = list(client.images(page, limit=40).values())
    files = [f for f in files if not JUNK_IMAGE.search(f.title)]
    if not files:
        return []
    client.batch_imageinfo(files[:20])
    out = []
    for f in files[:20]:
        url = getattr(f, "url", None)
        if not url or getattr(f, "mime", "") not in OK_MIME:
            continue
        width = getattr(f, "width", 0) or 0
        if 0 < width < 150:
            continue
        out.append({
            "title": f.title,
            "caption": caption_of(f.title),
            "thumb": thumb_url(url, 480),
            "full": thumb_url(url, 1200),
            "width": width,
            "height": getattr(f, "height", 0) or 0,
        })  # fmt: skip
        if len(out) == MAX_IMAGES:
            break
    return out


def article_for(name: str, aliases: list[str] | None = None, explicit: str = "") -> dict:
    """Look up a protein. Raises WikipediaException subclasses if Wikipedia is unreachable."""
    client = get_client()
    page, how = find_page(client, name, aliases or [], explicit)
    if page is None:
        return {"found": False, "detail": "No matching Wikipedia article was found."}
    return {
        "found": True,
        "title": page.title,
        "summary": page.summary,
        "sections": sections_of(page),
        "images": images_of(client, page),
        "matched_by": how,
        "source_url": page.fullurl,
        "license": LICENSE,
        "attribution": (
            "Text and images from Wikipedia and Wikimedia Commons, available under CC BY-SA 4.0 "
            "(some images have other free licences)."
        ),
    }
