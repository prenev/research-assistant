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
| 3. Editing everywhere | Not started |
| 4. Papers, proteins, log | Not started |
| 5. Visualisations | Not started |
| 6. Production and polish | Not started |

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

## Backend notes

- Every editable model has version history (`/<model>/<id>/history/`, `POST .../restore/<history_id>/`)
  and soft delete (30-day Trash; `manage.py purge_trash`).
- Reads need login unless **Site settings → public read** is on. Writes always need login.
- Results with fewer events than the configured minimum are rejected unless
  `confirmed_permitted` is set (data policy).
