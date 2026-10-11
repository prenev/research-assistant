"""Obsidian-style connections: [[wikilinks]], backlinks, a note graph, wanted pages and orphans.

Nothing is stored. Every request reads the text fields of the live items and works the links out,
so links stay correct when titles change or items are deleted.
"""

import re

from rest_framework.response import Response
from rest_framework.views import APIView

from apps.docs.models import DocPage
from apps.journal.models import LogPost
from apps.literature.models import Paper, Tag
from apps.project.models import Decision
from apps.proteins.models import Protein

WIKILINK = re.compile(r"\[\[([^\[\]|\n]+?)(?:\|([^\[\]\n]*?))?\]\]")
SHORTCODE = re.compile(r"\{\{\s*(paper|protein|cite)\s*:\s*([^}]*?)\s*\}\}")
FENCE = re.compile(r"```.*?```|`[^`\n]*`", re.S)

TYPE_LABEL = {
    "docs": "Doc",
    "papers": "Paper",
    "proteins": "Protein",
    "log": "Log",
    "decisions": "Decision",
}


def norm(text):
    return re.sub(r"\s+", " ", (text or "").strip()).lower()


def strip_code(text):
    return FENCE.sub(" ", text or "")


def load_items():
    """Every live item as a dict: type, url, title, aliases, text, tag ids."""
    items = []
    for p in DocPage.objects.select_related("category").prefetch_related("tags"):
        items.append(
            {
                "type": "docs",
                "key": p.slug,
                "url": f"/docs/{p.slug}",
                "title": p.title,
                "aliases": [p.slug, p.sidebar_label],
                "text": f"{p.description}\n{p.body}",
                "tags": [t.pk for t in p.tags.all() if not t.deleted_at],
                "context": p.category.title,
            }
        )
    for p in Paper.objects.prefetch_related("tags"):
        items.append(
            {
                "type": "papers",
                "key": p.slug,
                "url": f"/papers/{p.slug}",
                "title": p.title,
                "aliases": [p.slug, p.short_label],
                "text": "\n".join([p.notes, p.key_finding, p.why_it_matters, p.methods_to_borrow]),
                "tags": [t.pk for t in p.tags.all() if not t.deleted_at],
                "context": p.short_label,
                "citation_number": p.citation_number,
            }
        )
    for p in Protein.objects.prefetch_related("tags"):
        items.append(
            {
                "type": "proteins",
                "key": p.slug,
                "url": f"/proteins/{p.slug}",
                "title": p.name,
                "aliases": [p.slug, p.olink_assay_name, *p.aliases],
                "text": f"{p.rationale}\n{p.notes}",
                "tags": [t.pk for t in p.tags.all() if not t.deleted_at],
                "context": p.get_category_display(),
            }
        )
    for p in LogPost.objects.prefetch_related("tags", "linked_papers", "linked_proteins"):
        items.append(
            {
                "type": "log",
                "key": p.slug,
                "url": f"/log/{p.slug}",
                "title": p.title,
                "aliases": [p.slug],
                "text": p.body,
                "tags": [t.pk for t in p.tags.all() if not t.deleted_at],
                "context": str(p.date),
                "linked": [f"/papers/{x.slug}" for x in p.linked_papers.all()]
                + [f"/proteins/{x.slug}" for x in p.linked_proteins.all()],
            }
        )
    for d in Decision.objects.prefetch_related("tags"):
        items.append(
            {
                "type": "decisions",
                "key": d.slug,
                "url": f"/decisions#{d.slug}",
                "title": d.title,
                "aliases": [d.slug],
                "text": f"{d.decision}\n{d.rationale}",
                "tags": [t.pk for t in d.tags.all() if not t.deleted_at],
                "context": d.get_status_display(),
            }
        )
    return items


def build_lookup(items):
    """Lower-cased title/alias -> item. Titles win over aliases when two items claim a name."""
    lookup = {}
    for it in items:
        for alias in it["aliases"]:
            if alias:
                lookup.setdefault(norm(alias), it)
    for it in items:
        lookup[norm(it["title"])] = it
    return lookup


def snippet(text, start, end, radius=70):
    a, b = max(0, start - radius), min(len(text), end + radius)
    out = re.sub(r"\s+", " ", text[a:b]).strip()
    return ("…" if a else "") + out + ("…" if b < len(text) else "")


def analyse(items):
    """Return (edges, wanted). An edge is {source, target, context, label}."""
    lookup = build_lookup(items)
    by_url = {it["url"]: it for it in items}
    by_cite = {it["citation_number"]: it for it in items if it.get("citation_number") is not None}
    edges, wanted, seen = [], {}, set()

    def add(src, dst, context, label=""):
        if src["url"] == dst["url"]:
            return
        key = (src["url"], dst["url"])
        if key in seen:
            return
        seen.add(key)
        edges.append(
            {"source": src["url"], "target": dst["url"], "context": context, "label": label}
        )

    for it in items:
        text = strip_code(it["text"])
        for m in WIKILINK.finditer(text):
            target = lookup.get(norm(m.group(1)))
            if target:
                add(it, target, snippet(text, m.start(), m.end()), (m.group(2) or "").strip())
            else:
                w = wanted.setdefault(norm(m.group(1)), {"title": m.group(1).strip(), "from": []})
                if it["url"] not in [f["url"] for f in w["from"]]:
                    w["from"].append({"url": it["url"], "title": it["title"], "type": it["type"]})
        for m in SHORTCODE.finditer(text):
            kind, arg = m.group(1), m.group(2)
            if kind == "paper":
                dst = by_url.get(f"/papers/{arg}")
                if dst:
                    add(it, dst, snippet(text, m.start(), m.end()))
            elif kind == "protein":
                dst = by_url.get(f"/proteins/{arg}")
                if dst:
                    add(it, dst, snippet(text, m.start(), m.end()))
            else:
                for n in arg.split(","):
                    n = n.strip()
                    if n.isdigit() and int(n) in by_cite:
                        add(it, by_cite[int(n)], snippet(text, m.start(), m.end()))
        for url in it.get("linked", []):
            if url in by_url:
                add(it, by_url[url], "Linked in the log post's sidebar")
    return edges, list(wanted.values())


def brief(it):
    return {"type": it["type"], "title": it["title"], "url": it["url"], "context": it["context"]}


class LinkIndexView(APIView):
    """Names that [[wikilinks]] and the @ picker can point at."""

    def get(self, request):
        return Response(
            [
                {**brief(it), "aliases": [a for a in it["aliases"] if a and a != it["title"]]}
                for it in load_items()
            ]
        )


class LinkGraphView(APIView):
    """Notes as a graph, plus pages that are linked to but do not exist, and items with no links."""

    def get(self, request):
        items = load_items()
        edges, wanted = analyse(items)
        degree = {}
        for e in edges:
            degree[e["source"]] = degree.get(e["source"], 0) + 1
            degree[e["target"]] = degree.get(e["target"], 0) + 1
        tags = {t.pk: t for t in Tag.objects.all()}
        nodes = [
            {
                **brief(it),
                "degree": degree.get(it["url"], 0),
                "tags": [
                    {"id": t, "name": tags[t].name, "slug": tags[t].slug, "colour": tags[t].colour}
                    for t in it["tags"]
                    if t in tags
                ],
            }
            for it in items
        ]
        orphans = [
            n for n in nodes if n["degree"] == 0 and n["type"] in {"docs", "log", "decisions"}
        ]
        return Response(
            {
                "nodes": nodes,
                "edges": [{k: e[k] for k in ("source", "target", "label")} for e in edges],
                "wanted": sorted(wanted, key=lambda w: -len(w["from"])),
                "orphans": orphans,
            }
        )


class BacklinksView(APIView):
    """What links to an item, what it links to, and unlinked mentions of its name."""

    def get(self, request):
        url = request.query_params.get("url", "")
        items = load_items()
        by_url = {it["url"]: it for it in items}
        me = by_url.get(url)
        if not me:
            return Response({"incoming": [], "outgoing": [], "mentions": []})
        edges, _ = analyse(items)
        incoming = [
            {**brief(by_url[e["source"]]), "snippet": e["context"]}
            for e in edges
            if e["target"] == url
        ]
        outgoing = [
            {**brief(by_url[e["target"]]), "snippet": e["context"]}
            for e in edges
            if e["source"] == url
        ]
        linked = {x["url"] for x in incoming}
        mentions = []
        needle = re.compile(r"(?<![\w\[])" + re.escape(me["title"]) + r"(?![\w\]])", re.I)
        if len(me["title"]) >= 4:
            for it in items:
                if it["url"] == url or it["url"] in linked:
                    continue
                text = strip_code(it["text"])
                m = needle.search(text)
                if m:
                    mentions.append({**brief(it), "snippet": snippet(text, m.start(), m.end())})
        return Response({"incoming": incoming, "outgoing": outgoing, "mentions": mentions[:20]})


class TagItemsView(APIView):
    """Everything carrying ALL of the given tags (?tags=a,b), across every kind of item."""

    def get(self, request):
        slugs = [s for s in request.query_params.get("tags", "").split(",") if s]
        tags = list(Tag.objects.filter(slug__in=slugs))
        if not tags:
            return Response({"tags": [], "items": []})
        want = {t.pk for t in tags}
        out = [{**brief(it), "tags": it["tags"]} for it in load_items() if want <= set(it["tags"])]
        return Response(
            {
                "tags": [
                    {"id": t.pk, "name": t.name, "slug": t.slug, "colour": t.colour} for t in tags
                ],
                "items": out,
            }
        )
