# FTD Inflammation Notebook

A personal research notebook (Django + React) for tracking literature, candidate inflammatory
proteins, findings, analysis decisions and progress for one question:

> Can a minimal panel of circulating inflammatory proteins improve the prediction of incident
> frontotemporal dementia (FTD) beyond demographics and established blood biomarkers?

> ## ⚠ Data policy
> This app must **never** hold UK Biobank participant-level data. Only protein names, panel
> annotations, literature, plans, decisions, notes and **permitted aggregate results** belong here.
> There is no feature for uploading participant data.

Full build spec: [`PROMPT.md`](PROMPT.md). Plan: [`PLAN.md`](PLAN.md). Deviations:
[`DECISIONS_DEV.md`](DECISIONS_DEV.md). Missing seed data: [`SEED_DATA_TODO.md`](SEED_DATA_TODO.md).

## Status

| Phase | State |
|---|---|
| 1. Backend foundation | Done |
| 2. Docusaurus-style shell | Done (search, edit mode and visualisations come in later phases) |
| 3. Editing everywhere | Done (see notes below) |
| 4. Papers, proteins, log | Done |
| 5. Visualisations | Not started |
| 6. Production and polish | Not started |

**Hosting for free:** see [`DEPLOY.md`](DEPLOY.md) (Render + Neon, login-only).

## Quick start (backend)

```bash
make setup        # venv + dependencies
make seed         # migrate + load seed data (safe to re-run)
make superuser    # create your login
make dev          # http://localhost:8000
make test
```

- API: `http://localhost:8000/api/v1/`, docs at `/api/docs/`
- Admin: `/admin/`
- Configuration: copy `.env.example` to `.env` (production needs `SECRET_KEY`)

## Frontend (Phase 2)

```bash
cd frontend && npm install
npm run dev        # http://localhost:5173, proxies /api to Django on :8000
npm test           # Vitest
npm run build
# Playwright e2e (needs the backend running with seed data and a user)
E2E_USER=owner E2E_PASSWORD=... npx playwright test
```

Built on Infima (the CSS Docusaurus uses). Includes the navbar with mobile drawer, dark mode
with no flash, the three-column docs layout driven by `/api/v1/sidebar/`, breadcrumbs, TOC with
scrollspy, prev/next, category card pages, and a Markdown renderer for admonitions, titled and
highlighted code blocks, tabs, details, and the `{{cite}}`, `{{paper}}`, `{{protein}}` and `{{viz}}`
embeds. Raw HTML in Markdown is never rendered.

Not yet built: search (Phase 4), edit mode and quick add (Phase 3), the home page's mini evidence
matrix (Phase 5). Those controls are visible but disabled or absent.

## Editing (Phase 3)

Log in, then use the **pencil** in the navbar to turn on edit mode and **＋** for Quick add.

- **Docs:** *Edit this page* edits in place with a block editor (type `/` for headings, lists, tables,
  code, images, admonitions, citations and embeds). It autosaves a draft every couple of seconds;
  **Save** publishes, **Discard** reverts. Every item has a **History** panel with a side-by-side
  diff and one-click restore. Autosaves do not clutter history.
- **Papers:** add by DOI (Crossref lookup, review before saving; falls back to manual entry), or
  import a BibTeX or Zotero CSV export with a preview that flags duplicates.
  Export BibTeX, an IEEE list ordered by citation number, or a full JSON backup from **Settings**.
- **Forms** for papers, proteins, findings, decisions, pipeline stages, log posts, doc pages and
  results. Related items use typeahead with inline *create new*. The results form shows the data
  policy and requires a confirmation below the minimum event count.
- **Reordering:** drag sidebar pages and categories, or use the ↑ ↓ buttons. Pipeline stages too.
- **Delete** always asks first and moves the item to **Trash** (30 days, restorable).

```bash
make e2e          # Playwright on a throwaway database (start with: cd frontend && npm install)
```

Not yet in the UI: the Log pages (Phase 4), search (Phase 4), visualisations (Phase 5), the
pipeline kanban board (Phase 5).

## Papers, proteins, log and search (Phase 4)

- **Papers:** filter by population, design, status, review section, fluid, protein, tag, year and text.
  Filters live in the URL, so a filtered view can be bookmarked. Table or card view, sortable columns.
  Each paper page shows the IEEE reference (with copy), metadata, key finding, limitations, findings,
  requirement assessments and linked log posts.
- **Proteins:** filterable list and a profile page with charts of findings by direction and population,
  the evidence table, linked log posts and any decision that mentions the protein.
- **About a protein (Wikipedia):** tap **ⓘ Info** on a protein (or open its profile) to read the
  Wikipedia article's summary, sections and images inside the app, with an image viewer. Nothing sends
  you to Wikipedia. The server fetches it with the Wikipedia-API package and caches it for a day. If the
  automatic match is wrong, set **Wikipedia article title** when editing the protein. Text is CC BY-SA
  4.0, so attribution is shown.
- **Log:** Docusaurus-style blog with *Recent posts*, pagination, tags, archive, reading time, a
  `<!-- truncate -->` cut-off, linked papers/proteins/stages, and newer/older links. Edit posts in place.
- **Search:** press **Ctrl K** / **⌘ K**. Results are grouped (Docs, Papers, Proteins, Log, Decisions),
  highlighted, and include anything you saved a moment ago.

## Backend notes

- Every editable model has version history (`/<model>/<id>/history/`, `POST .../restore/<history_id>/`)
  and soft delete (30-day Trash; `manage.py purge_trash`).
- Reads need login unless **Site settings → public read** is on. Writes always need login.
- Results with fewer events than the configured minimum are rejected unless
  `confirmed_permitted` is set (data policy).
