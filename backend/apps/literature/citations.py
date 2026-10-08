"""Crossref lookup, IEEE formatting, and BibTeX / Zotero CSV parsing. No participant data here."""

import csv
import io
import json
import re
import urllib.error
import urllib.parse
import urllib.request

CROSSREF = "https://api.crossref.org/works/"
USER_AGENT = "ftd-notebook/1.0 (personal research notebook)"


def normalise_doi(value: str) -> str:
    v = (value or "").strip()
    v = re.sub(r"^(https?://)?(dx\.)?doi\.org/", "", v, flags=re.I)
    v = re.sub(r"^doi:\s*", "", v, flags=re.I)
    return v.strip().lower()


def initials(given: str) -> str:
    """'Jo-Ann B' -> 'J.-A. B.' (hyphenated names keep the hyphen, as in IEEE style)."""
    out = []
    for word in (given or "").split():
        out.append("-".join(f"{p[0].upper()}." for p in word.split("-") if p))
    return " ".join(out)


def author_name(a: dict) -> str:
    ini = initials(a.get("given", ""))
    return f"{ini} {a.get('family', '')}".strip()


def authors_display(authors: list[dict]) -> str:
    if not authors:
        return ""
    first = author_name(authors[0])
    return first if len(authors) == 1 else f"{first} et al."


def ieee_reference(meta: dict) -> str:
    """Format an IEEE-style journal reference from fields plus `authors_list`."""
    names = [author_name(a) for a in meta.get("authors_list", [])]
    if len(names) > 6:
        who = f"{names[0]} et al."
    elif len(names) > 2:
        who = ", ".join(names[:-1]) + f", and {names[-1]}"
    else:
        who = " and ".join(names)
    parts = []
    if who:
        parts.append(who + ",")
    if meta.get("title"):
        parts.append(f"“{meta['title'].rstrip('.')},”")
    tail = []
    if meta.get("journal"):
        tail.append(meta["journal"])
    if meta.get("volume"):
        tail.append(f"vol. {meta['volume']}")
    if meta.get("issue"):
        tail.append(f"no. {meta['issue']}")
    if meta.get("article_number"):
        tail.append(f"Art. no. {meta['article_number']}")
    elif meta.get("pages"):
        tail.append(f"pp. {meta['pages'].replace('-', '–')}")
    if meta.get("year"):
        tail.append(str(meta["year"]))
    if meta.get("doi"):
        tail.append(f"doi: {meta['doi']}")
    return (" ".join(parts) + " " + ", ".join(tail)).strip().rstrip(",") + "."


def fetch_crossref(doi: str, timeout: float = 8.0) -> dict:
    """Return Crossref `message` dict. Raises LookupError (not found) or ConnectionError."""
    req = urllib.request.Request(
        CROSSREF + urllib.parse.quote(doi, safe="/"), headers={"User-Agent": USER_AGENT}
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
            return json.load(resp)["message"]
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise LookupError("DOI not found on Crossref.") from exc
        raise ConnectionError(f"Crossref returned {exc.code}.") from exc
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError) as exc:
        raise ConnectionError("Could not reach Crossref.") from exc


def strip_tags(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "").strip()


def paper_fields_from_crossref(msg: dict) -> dict:
    authors = [
        {"given": a.get("given", ""), "family": a.get("family", a.get("name", ""))}
        for a in msg.get("author", [])
    ]
    issued = msg.get("issued") or msg.get("published-print") or msg.get("published-online") or {}
    year = None
    try:
        year = issued["date-parts"][0][0]
    except (KeyError, IndexError, TypeError):
        pass
    doi = normalise_doi(msg.get("DOI", ""))
    fields = {
        "title": strip_tags((msg.get("title") or [""])[0]),
        "authors": authors_display(authors),
        "first_author_surname": authors[0]["family"] if authors else "",
        "year": year,
        "journal": strip_tags((msg.get("container-title") or [""])[0]),
        "volume": msg.get("volume", ""),
        "issue": msg.get("issue", ""),
        "pages": msg.get("page", ""),
        "article_number": msg.get("article-number", ""),
        "doi": doi,
        "url": msg.get("URL", ""),
    }
    fields["ieee_reference"] = ieee_reference({**fields, "authors_list": authors})
    return fields


# ---- BibTeX ----
_ENTRY = re.compile(r"@(\w+)\s*\{\s*([^,\s]*)\s*,", re.S)


def _read_braced(s: str, i: int) -> tuple[str, int]:
    depth, j = 1, i + 1
    while j < len(s) and depth:
        depth += {"{": 1, "}": -1}.get(s[j], 0)
        j += 1
    return s[i + 1 : j - 1], j


def parse_bibtex(text: str) -> list[dict]:
    entries = []
    for m in _ENTRY.finditer(text):
        if m.group(1).lower() in ("comment", "string", "preamble"):
            continue
        i, tags = m.end(), {}
        field_re = re.compile(r"\s*([\w\-]+)\s*=\s*")
        while (km := field_re.match(text, i)) is not None:
            key, i = km.group(1).lower(), km.end()
            if text[i : i + 1] == "{":
                val, i = _read_braced(text, i)
            elif text[i : i + 1] == '"':
                j = text.index('"', i + 1)
                val, i = text[i + 1 : j], j + 1
            else:
                vm = re.compile(r"[^,}\s]+").match(text, i)
                val, i = (vm.group(0), vm.end()) if vm else ("", i)
            tags[key] = re.sub(r"\s+", " ", val.replace("{", "").replace("}", "")).strip()
            i = re.compile(r"\s*,?").match(text, i).end()
        entries.append(_bib_to_fields(tags))
    return entries


def _split_bib_authors(s: str) -> list[dict]:
    out = []
    for a in re.split(r"\s+and\s+", s or ""):
        a = a.strip()
        if not a:
            continue
        if "," in a:
            fam, giv = [x.strip() for x in a.split(",", 1)]
        else:
            bits = a.split()
            fam, giv = bits[-1], " ".join(bits[:-1])
        out.append({"given": giv, "family": fam})
    return out


def _bib_to_fields(tags: dict) -> dict:
    authors = _split_bib_authors(tags.get("author", ""))
    year = re.search(r"\d{4}", tags.get("year", "") or tags.get("date", ""))
    fields = {
        "title": tags.get("title", ""),
        "authors": authors_display(authors),
        "first_author_surname": authors[0]["family"] if authors else "",
        "year": int(year.group(0)) if year else None,
        "journal": tags.get("journal", "") or tags.get("journaltitle", ""),
        "volume": tags.get("volume", ""),
        "issue": tags.get("number", ""),
        "pages": tags.get("pages", "").replace("--", "-"),
        "article_number": tags.get("articleno", "") or tags.get("eid", ""),
        "doi": normalise_doi(tags.get("doi", "")),
        "url": tags.get("url", ""),
    }
    fields["ieee_reference"] = ieee_reference({**fields, "authors_list": authors})
    return fields


# ---- Zotero CSV ----
def parse_zotero_csv(text: str) -> list[dict]:
    out = []
    for row in csv.DictReader(io.StringIO(text.lstrip("﻿"))):
        authors = []
        for a in re.split(r";\s*", row.get("Author", "") or ""):
            if not a.strip():
                continue
            fam, _, giv = a.partition(",")
            authors.append({"given": giv.strip(), "family": fam.strip()})
        year = re.search(r"\d{4}", row.get("Publication Year", "") or row.get("Date", ""))
        fields = {
            "title": row.get("Title", "").strip(),
            "authors": authors_display(authors),
            "first_author_surname": authors[0]["family"] if authors else "",
            "year": int(year.group(0)) if year else None,
            "journal": row.get("Publication Title", "").strip(),
            "volume": row.get("Volume", "").strip(),
            "issue": row.get("Issue", "").strip(),
            "pages": (row.get("Pages", "") or "").replace("--", "-").strip(),
            "article_number": "",
            "doi": normalise_doi(row.get("DOI", "")),
            "url": row.get("Url", "").strip(),
        }
        fields["ieee_reference"] = ieee_reference({**fields, "authors_list": authors})
        out.append(fields)
    return out


# ---- export ----
def bibtex_entry(paper) -> str:
    key = f"{paper.first_author_surname or 'ref'}{paper.year or ''}".replace(" ", "")
    if paper.citation_number:
        key += f"_{paper.citation_number}"
    fields = {
        "title": paper.title,
        "author": paper.authors,
        "journal": paper.journal,
        "year": paper.year,
        "volume": paper.volume,
        "number": paper.issue,
        "pages": paper.pages.replace("-", "--") if paper.pages else "",
        "doi": paper.doi,
        "url": paper.url,
    }
    body = ",\n".join(f"  {k} = {{{v}}}" for k, v in fields.items() if v)
    return f"@article{{{key},\n{body}\n}}"
