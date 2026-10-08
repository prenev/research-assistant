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
| 2. Docusaurus-style shell | Not started |
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

## Backend notes

- Every editable model has version history (`/<model>/<id>/history/`, `POST .../restore/<history_id>/`)
  and soft delete (30-day Trash; `manage.py purge_trash`).
- Reads need login unless **Site settings → public read** is on. Writes always need login.
- Results with fewer events than the configured minimum are rejected unless
  `confirmed_permitted` is set (data policy).
