# Plan

Follows `PROMPT.md` phase by phase. Each phase ends with passing tests, README updated, a commit.

## Phase 1: Backend foundation (done)
Django 5 project (`backend/config`), seven apps, all models with history and soft delete,
DRF viewsets with django-filter, session auth with login throttle, OpenAPI at `/api/docs/`,
Django admin for every model, idempotent `seed`. Tested with pytest (27 tests).

## Phase 2: Docusaurus-identical shell (done)
Vite + React + TS + Infima. Navbar (sticky, 60px), footer, dark mode without flash, mobile drawer,
docs three-column layout driven by `/sidebar/`, breadcrumbs, TOC with scrollspy, prev/next,
doc cards, markdown renderer (admonitions, code blocks, tabs, details, embeds), home hero.
Compare against a default Docusaurus 3 site.

## Phase 3: Editing everywhere
Login, edit mode, BlockNote with Markdown round trip and embed pickers, autosave to `draft_body`,
history panel with diff and restore, structured forms, Quick add, DOI lookup (Crossref), BibTeX and
Zotero import, exports, drag-and-drop ordering, Trash page. Backend: the deferred endpoints.
Playwright flows 1–2.

## Phase 4: Papers, proteins and log
Paper list (table and cards), paper and protein pages, blog-style log with tags and archive,
Ctrl-K search with Fuse.js. Playwright flow 3.

## Phase 5: Visualisations
Evidence matrix, gap map, network, timeline, evidence chain, pipeline board, results panel, embeds,
PNG/SVG export, fake-data generator. `viz/*` endpoints. Playwright flow 4.

## Phase 6: Production and polish
Docker Compose (gunicorn, Postgres, nginx), nightly backups, security settings, accessibility and
performance passes, full README. All six Playwright flows.
