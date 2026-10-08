# Build Prompt: FTD Inflammation Research Notebook (Django + React)

> Paste this whole file into your coding agent (e.g. Claude Code), or save it in the repo root as `PROMPT.md` and tell the agent to follow it.
> Attach my A3 document (literature review + research plan) so the seed data can be filled in.

---

## 0. How to work on this project

- Build in the **phases** listed in Section 13. Finish each phase completely, run its checks, and commit before starting the next one.
- At the start, read this whole file, then write `PLAN.md` summarising how you will implement each phase. Keep `PLAN.md` updated as you go.
- If something in this spec is ambiguous or impossible, stop and ask me rather than guessing. If you deviate from the spec, record why in `DECISIONS_DEV.md`.
- **Never invent research data.** Study results, effect sizes, sample sizes, DOIs and citations must come only from material I provide. If a detail is missing, leave the field empty and list it in `SEED_DATA_TODO.md`.
- After setup, I must never need to edit code or files to use the site. Everything (adding papers, writing notes, editing pages, updating progress) must be possible from the browser.

---

## 1. Project context

I'm a master's student. My research question is:

> **Can a minimal panel of circulating inflammatory proteins improve the prediction of incident frontotemporal dementia (FTD) beyond demographics and established blood biomarkers?**

The planned analysis uses UK Biobank baseline Olink plasma proteomics. Penalised Cox regression with repeated nested cross-validation compares three models:

- **M1:** age + sex
- **M2:** M1 + NfL (Olink NEFL)
- **M3:** M2 + selected inflammatory proteins

The primary comparison is M3 vs M2, using the paired change in time-dependent AUC plus calibration. Secondary analyses add GFAP and prespecified all-cause dementia risk factors. Sensitivity analyses exclude diagnoses within 2 and 5 years, examine participants with markedly raised CRP, and adjust for baseline depression.

The site is my **personal research notebook**. It's where I track literature, candidate proteins, findings, analysis decisions and progress, and where I write notes and visualise the evidence.

---

## 2. Goals and non-goals

**Goals**
- A web app that **looks and behaves exactly like a Docusaurus documentation site** (Section 6), with my own branding and extra visualisation features.
- Full **in-browser editing** of everything: docs pages, notes, papers, proteins, findings, log posts, decisions, pipeline stages.
- Structured, relational tracking: papers ↔ proteins ↔ findings.
- Rich interactive **visualisations** of the evidence (Section 8).
- Instant saves, no rebuilds.

**Non-goals**
- Multi-user collaboration (single owner account is enough; design so extra users could be added later).
- Storing or analysing UK Biobank participant-level data (forbidden; see Section 11).
- Running the statistical analysis inside the app.

---

## 3. Tech stack

Use current stable versions of everything below.

**Backend**
- Python 3.12+
- Django 5.x
- Django REST Framework
- django-filter (API filtering)
- drf-spectacular (OpenAPI schema + Swagger UI at `/api/docs/`)
- django-simple-history (version history for all editable models)
- django-cors-headers (dev only, if frontend runs on a separate port)
- SQLite for local development, PostgreSQL 16+ for production (configured via `DATABASE_URL` env var using dj-database-url)
- Session authentication with CSRF protection (same-origin), not JWT
- pytest + pytest-django for tests

**Frontend**
- React 18+ with TypeScript, built with Vite
- React Router (client-side routing)
- TanStack Query (data fetching, caching, optimistic updates)
- **Infima** (the open-source CSS framework Docusaurus uses, MIT licensed, npm package `infima`) as the base stylesheet, so the look matches Docusaurus exactly
- BlockNote (block-based rich-text editor) for all long-form content, storing content as Markdown in the backend
- react-markdown + remark-gfm + rehype-slug for rendering
- Prism (via prism-react-renderer) for code blocks, matching Docusaurus code block styling
- D3 for the evidence matrix, gap map and network graph; Recharts for simpler charts
- Fuse.js for client-side fuzzy search over a search index served by the API
- Vitest + React Testing Library for unit tests; Playwright for end-to-end tests

**Tooling**
- Ruff (Python lint/format), ESLint + Prettier (TypeScript)
- Docker + Docker Compose for production-like runs
- Makefile with common commands (`make dev`, `make test`, `make seed`, `make backup`)

---

## 4. Repository structure

```
ftd-notebook/
├── backend/
│   ├── config/                 # Django settings (base, dev, prod), urls, wsgi
│   ├── apps/
│   │   ├── core/               # User, site settings, search index, export/backup
│   │   ├── literature/         # Paper, Author, Tag, Finding
│   │   ├── proteins/           # Protein, ProteinPanel
│   │   ├── docs/               # DocPage, DocCategory (sidebar tree)
│   │   ├── journal/            # LogPost (blog)
│   │   ├── project/            # PipelineStage, Decision, ResultEntry
│   │   └── synthesis/          # Requirement, RequirementAssessment
│   ├── fixtures/               # Seed data JSON
│   ├── manage.py
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── theme/              # Docusaurus-style layout components
│   │   ├── components/         # Shared UI (Admonition, Tabs, Badge, etc.)
│   │   ├── features/           # papers, proteins, docs, log, pipeline, decisions, viz
│   │   ├── api/                # Typed API client + TanStack Query hooks
│   │   ├── editor/             # BlockNote wrapper + Markdown conversion
│   │   └── styles/             # custom.css overriding Infima variables
│   ├── index.html
│   └── vite.config.ts
├── docker-compose.yml
├── Makefile
├── README.md
├── PLAN.md
├── DECISIONS_DEV.md
└── SEED_DATA_TODO.md
```

In production, Django serves the API under `/api/` and the built React app is served by nginx (or WhiteNoise) for all other routes.

---

## 5. Data model

All editable models get `created_at`, `updated_at` and history tracking (django-simple-history). Use slugs for human-readable URLs. Enums are Django `TextChoices`.

### 5.1 Paper
| Field | Type | Notes |
|---|---|---|
| citation_number | int, nullable, unique | Matches my A3 reference number, e.g. 1–28 |
| title | text | |
| authors | text | Display string, e.g. "M. Malpetti et al." |
| first_author_surname | char | For short labels like "Malpetti 2025" |
| year | int | |
| journal | char | |
| volume, issue, pages, article_number | char, optional | |
| doi | char, unique, nullable | |
| url | URL, optional | |
| ieee_reference | text | Full formatted IEEE reference string as in my A3 |
| design | enum | systematic_review, meta_analysis, cross_sectional, case_control, longitudinal, prediction, population_cohort, progression_model, other |
| population | enum | sporadic_ftd, genetic_ftd, mutation_carriers, general_population, mixed_neurodegenerative, other |
| sample_size | int, optional | |
| sample_size_note | char, optional | e.g. "214 patients across FTLD syndromes" |
| fluids | multi-select | plasma, serum, csf, brain_tissue, pet_imaging |
| platform | enum | olink, somascan, simoa, luminex, msd, elisa, nulisa, other, mixed |
| review_section | enum | intro, peripheral_inflammation, presymptomatic, added_value, population_methods, synthesis |
| key_finding | text | One or two sentences |
| limitations | JSON list of strings | |
| notes | Markdown | My free-form notes, edited with BlockNote |
| reading_status | enum | to_read, reading, read, cited |
| tags | M2M Tag | |
| proteins | M2M Protein through Finding | |

### 5.2 Protein
| Field | Type | Notes |
|---|---|---|
| name | char | Display name, e.g. "TNF-α" |
| slug | slug | e.g. "tnf-alpha" |
| aliases | JSON list | e.g. ["TNF", "TNFA"]; MCP-1 has alias "CCL2" |
| olink_assay_name | char, optional | e.g. "NEFL" for NfL |
| category | enum | cytokine, chemokine, cytokine_receptor, growth_factor, complement, acute_phase, neurodegeneration_marker, other |
| on_olink_panel | char, optional | Panel name if known |
| role | enum | candidate, comparator, excluded, selected, under_review |
| rationale | Markdown | Why it's a candidate |
| exclusion_reason | char, optional | e.g. "Failed QC", "High missingness" |
| notes | Markdown | |

### 5.3 Finding (links a paper to a protein)
| Field | Type | Notes |
|---|---|---|
| paper | FK Paper | |
| protein | FK Protein | |
| direction | enum | raised, lowered, no_difference, associated, not_associated, predictive, not_predictive, mixed |
| context | enum | symptomatic_vs_controls, ftd_vs_other_disease, presymptomatic_vs_noncarriers, conversion_prediction, progression_or_survival, incident_dementia_population, brain_correspondence, other |
| context_detail | char | e.g. "bvFTD vs controls, plasma" |
| effect | char, optional | Free text, e.g. "AUC 0.72", "HR 1.14 (95% CI 1.02–1.27)" |
| subgroup | char, optional | e.g. "MAPT and GRN carriers, not C9orf72" |
| fluid | enum | Same choices as Paper.fluids |
| notes | text, optional | |

### 5.4 DocPage and DocCategory (sidebar tree)
- **DocCategory:** title, slug, position, parent (self FK, nullable), collapsed_by_default (bool)
- **DocPage:** title, slug, category (FK), position, body (Markdown), description (for meta + cards), sidebar_label (optional), tags, last_edited_by
- Sidebar order is drag-and-drop reorderable from the UI.

### 5.5 LogPost (blog)
- title, slug, date, body (Markdown), summary (shown in list; auto-generated from first paragraph if blank), tags, linked_papers (M2M), linked_proteins (M2M), linked_pipeline_stages (M2M)
- Support a `<!-- truncate -->` marker like Docusaurus to control the preview cut-off.

### 5.6 PipelineStage
- title, slug, position, description (Markdown), status (not_started, in_progress, blocked, done), started_on, completed_on, blocked_reason, notes (Markdown)

### 5.7 Decision
- date, title, decision (text), rationale (Markdown), prespecified (bool: made before seeing outcome data), related_stage (FK PipelineStage, optional), status (proposed, adopted, superseded), superseded_by (self FK, optional)

### 5.8 ResultEntry (aggregate results only)
- title, date, model_label (M1, M2, M3, other), metric (time_dependent_auc, delta_auc, c_index, calibration_slope, brier, other), value (decimal), ci_lower, ci_upper, horizon_years, n_participants, n_events, notes, linked_stage
- **Validation:** see Section 11. Warn and require confirmation if n_events is below a configurable minimum.

### 5.9 Requirement and RequirementAssessment (synthesis)
- **Requirement:** the five requirements from my synthesis, seeded as: (1) peripheral inflammatory signal, (2) relevance before onset, (3) selected minimal panel, (4) added value beyond established risk factors and blood biomarkers, (5) applicability to incident FTD in the general population.
- **RequirementAssessment:** paper (FK), requirement (FK), met (enum: yes, partial, no), justification (text).

### 5.10 Tag
- name, slug, colour (optional). Shared across papers, docs and log posts.

### 5.11 SiteSettings (singleton)
- site_title, tagline, logo (upload), primary_colour, footer_text, public_read (bool, default false), min_event_count_warning (int)

---

## 6. UI specification: look exactly like Docusaurus

The interface must be visually indistinguishable in layout and behaviour from a default Docusaurus 3 site using the classic theme. Use Infima as the base CSS and replicate the classic theme's structure, spacing, typography and interactions. Do not use the Docusaurus logo or dinosaur mascot; use my own site title and a simple placeholder logo I can replace from settings.

### 6.1 Global layout
- **Navbar:** sticky, 60px tall, `navbar` Infima classes. Left: logo + site title. Then nav items: **Docs**, **Papers**, **Proteins**, **Visualise** (dropdown: Evidence Matrix, Gap Map, Network, Timeline, Evidence Chain), **Pipeline**, **Decisions**, **Log**. Right side: **Search** button (shows `Ctrl K` / `⌘ K` hint), **dark/light mode toggle** (sun/moon icon, identical to Docusaurus's), **Edit mode** toggle (pencil icon, only visible when logged in), user menu (login/logout).
- **Mobile:** below 996px, nav items collapse into a hamburger opening a left slide-out drawer, exactly like Docusaurus's mobile sidebar, including the "← Back to main menu" pattern for nested docs.
- **Footer:** dark footer (`footer--dark`) with link columns (Docs, Explore, Project) and a copyright line from settings.
- **Theme:** dark mode via `data-theme="dark"` on `<html>`, persisted in localStorage, defaulting to the OS preference, with no flash on load.
- **Colours:** define `--ifm-color-primary` and its 6 shades in `custom.css`, generated from `SiteSettings.primary_colour`. Default: a teal-blue (#1f7a8c) to differentiate from stock Docusaurus green.
- **Fonts:** Infima's default system font stack; monospace for code.

### 6.2 Docs pages
- Three-column layout identical to Docusaurus docs:
  - **Left sidebar** (300px): collapsible categories with chevrons, active page highlighted, nested levels indented, "collapse sidebar" button at the bottom (desktop), sticky and independently scrollable.
  - **Main content:** max-width matching Docusaurus (`col--8` behaviour within container), breadcrumbs at the top (home icon › category › page), H1 title, rendered Markdown.
  - **Right TOC** ("On this page"): generated from H2/H3, sticky, highlights the current heading while scrolling, hidden below 996px.
- Below content: **"Edit this page"** link (pencil icon), which switches the page into in-place edit mode rather than linking to GitHub; **"Last updated on [date]"**; then **Previous / Next** pagination cards exactly like Docusaurus.
- Category index pages show **doc cards** (bordered cards with an emoji icon, title, description) for each child page, like Docusaurus generated-index pages.
- Heading anchors: hover over a heading to show a `#` link, like Docusaurus.

### 6.3 Markdown features (render and author)
Support these in both the renderer and the editor:
- **Admonitions** with Docusaurus syntax and styling: `:::note`, `:::tip`, `:::info`, `:::warning`, `:::danger`, with optional titles.
- Code blocks with title bars, line highlighting, copy button, and language labels, styled like Docusaurus.
- Tables, task lists, footnotes (GFM).
- **Tabs** component like Docusaurus Tabs.
- **Details/summary** collapsibles styled like Docusaurus.
- **Embeds**, using a simple shortcode syntax the editor can insert from a menu:
  - `{{paper:malpetti-2025}}`: inline paper citation chip with hover card (title, journal, year, key finding)
  - `{{protein:tnf-alpha}}`: protein chip linking to its page
  - `{{cite:1}}` or `{{cite:1,2}}`: renders `[1]` / `[1], [2]` IEEE-style, linking to the paper
  - `{{viz:evidence-matrix population=general_population}}`: embed any visualisation, with filters, inside a doc or log post

### 6.4 Blog-style Log
- Identical to Docusaurus blog layout: left sidebar listing **Recent posts**, main column with post list (title, date, reading time, tags, summary, "Read more").
- Post page: title, date, reading time, tags, body, linked papers/proteins/stages shown as chips at the end, then **Newer / Older post** pagination.
- Tags pages: `/log/tags` (all tags with counts) and `/log/tags/:slug`.
- Archive page: `/log/archive` grouped by year and month.

### 6.5 Search
- `Ctrl K` / `⌘ K` opens a modal identical in feel to Docusaurus's DocSearch modal: input at top, grouped results (Docs, Papers, Proteins, Log, Decisions) with matched text highlighted, keyboard navigation (↑ ↓ Enter Esc).
- Backend endpoint returns a compact search index; client uses Fuse.js. Index updates immediately after any save.

### 6.6 Our twist (on top of the Docusaurus look)
Keep the Docusaurus feel, and add:
- A **home page** in the style of a Docusaurus landing page: hero banner (`hero hero--primary`) with site title, tagline and research question, two buttons ("Read the docs", "Explore evidence"). Below it, three feature cards showing live stats (papers tracked, proteins tracked, pipeline progress %), a "Recently edited" list and a mini evidence matrix preview.
- **Status badges** (Infima `badge` classes) for protein roles, reading status and pipeline status, used consistently everywhere.
- A **"Quick add" button** in the navbar (＋ icon, logged-in only) with: Add paper, Add protein, Add finding, New log post, New doc page, New decision.
- **Hover cards** on paper and protein chips everywhere.

---

## 7. Editing UX (no code, ever)

- **Edit mode toggle** in the navbar. When on, every editable page shows an edit affordance. Docs, log posts and notes switch to a BlockNote editor in place, keeping the Docusaurus layout around it.
- Editor toolbar/slash menu supports: headings, lists, task lists, quotes, code blocks, tables, images (upload to backend media storage), links, admonitions, tabs, details, and the embeds from Section 6.3 (with pickers that search papers, proteins and visualisations).
- **Autosave** drafts to the backend every few seconds while editing (draft field, not overwriting the published body). Explicit **Save** publishes; **Discard** reverts. Show "Saved · just now" status.
- **Version history:** every editable item has a "History" panel listing previous versions (timestamp, user) with a side-by-side diff and one-click restore.
- **Structured forms** (modal or side panel, consistent styling) for papers, proteins, findings, decisions, pipeline stages and results, with:
  - Dropdowns for enums; multi-select chips for M2M fields
  - Typeahead pickers for related items, with "create new" inline (e.g. add a protein while adding a finding)
  - Inline validation errors from the API
- **Add paper by DOI:** paste a DOI, and the backend fetches metadata from the Crossref REST API and pre-fills title, authors, journal, year, volume, pages and an IEEE-formatted reference. I review and save. If Crossref fails, fall back to manual entry.
- **Import:** upload a BibTeX or Zotero CSV export from the UI and preview the parsed entries. Duplicates (by DOI) are flagged, and I choose which to import.
- **Export:** download everything as JSON, papers as BibTeX, and the reference list as IEEE-formatted text ordered by citation number.
- **Drag-and-drop** reordering for sidebar docs, categories and pipeline stages.
- **Delete** always asks for confirmation and is soft-delete (recoverable from a "Trash" page for 30 days).
- Django admin stays available at `/admin/` as a fallback, but I should never need it.

---

## 8. Visualisations

All visualisations live under **Visualise** in the navbar. Each has its own page (Docusaurus doc layout with a filters panel in the right column instead of the TOC) and can be embedded in docs/log posts. All must:
- Read live data from the API (update immediately after edits)
- Support dark mode with a colour palette that works in both themes
- Be colour-blind safe (don't rely on colour alone; add symbols or patterns where it helps) and keyboard accessible
- Offer **export as PNG and SVG**
- Show an empty-state message with a "Quick add" link when there's no data
- Have clickable elements that open the related paper/protein hover card or page

### 8.1 Evidence Matrix
- Heatmap: rows = proteins, columns = papers (labelled "Surname Year [n]").
- Cell colour/symbol = finding direction (raised ▲, lowered ▼, no difference ○, predictive ★, etc.), with a legend.
- Filters: population, design, context, fluid, protein category, protein role.
- Sort rows by number of findings or alphabetically; sort columns by year or citation number.
- Tooltip: context detail, effect, subgroup.

### 8.2 Gap Map
- Grid: rows = population (sporadic FTD, genetic FTD, mutation carriers, general population), columns = design type grouped as cross-sectional, longitudinal/prognostic, prediction of incident disease.
- Each cell shows the count of papers and their short labels; cell shading by count.
- Empty cells are highlighted as gaps, with a callout on the **incident FTD, general population** cell labelled "This project".
- Toggle: count papers, or count findings for a selected protein.

### 8.3 Protein–Paper Network
- Force-directed graph (D3): protein nodes and paper nodes; edges = findings, coloured by direction.
- Node size = number of connections. Proteins and papers visually distinct (shape + colour).
- Zoom, pan, drag nodes, click to focus (dim everything not connected), search box to highlight a node.
- Filters: same as the Evidence Matrix.

### 8.4 Literature Timeline
- Scatter/bubble chart: x = year, y = sample size (log scale), bubble colour = design, bubble shape = population.
- Hover shows paper details; click opens the paper.
- Optional overlay: count of papers per year as a bar strip underneath.

### 8.5 Evidence Chain
- Table/heatmap: rows = papers, columns = the five synthesis requirements (Section 5.9), cells = yes / partial / no, with icons.
- A summary row shows whether any paper meets all five (the expected answer is none, which is the research gap).
- Editable inline: click a cell to set met/partial/no and add a justification.

### 8.6 Pipeline Board
- Kanban with columns: Not started, In progress, Blocked, Done. Cards = pipeline stages, draggable between columns (updates status).
- A progress bar at the top shows % of stages done.
- Alternative view toggle: vertical timeline/stepper ordered by position, showing start/completion dates.

### 8.7 Results Panel
- Forest-plot style chart of ResultEntry values with confidence intervals, grouped by metric and model (M1, M2, M3), with horizon and event count shown.
- A dedicated card for the primary comparison (ΔAUC M3 vs M2 with 95% CI), clearly labelled whether the CI excludes zero.
- Empty until I enter results; banner reminding that only permitted aggregate results belong here.

### 8.8 Protein Profile page (per protein)
- Header: name, aliases, Olink assay name, category badge, role badge.
- Rationale and notes (editable).
- Mini evidence strip: every finding for this protein as a row (paper, direction icon, context, effect).
- Small charts: findings by direction (bar), findings by population (bar).
- Linked log posts and decisions.

### 8.9 Paper page (per paper)
- Full IEEE reference with copy button, DOI link, metadata table, key finding (in a `:::tip` admonition), limitations list (in a `:::warning` admonition), my notes (editable), findings table, requirement assessments, linked log posts.

---

## 9. API

REST, under `/api/v1/`, documented automatically at `/api/docs/` (drf-spectacular).

- CRUD viewsets for: `papers`, `proteins`, `findings`, `tags`, `doc-categories`, `doc-pages`, `log-posts`, `pipeline-stages`, `decisions`, `results`, `requirements`, `requirement-assessments`
- Filtering and search via django-filter on all list endpoints (e.g. `/papers/?population=general_population&design=prediction&protein=tnf-alpha`)
- `GET /api/v1/sidebar/`: full docs sidebar tree
- `POST /api/v1/sidebar/reorder/`: drag-and-drop reorder
- `GET /api/v1/search-index/`: compact index for Fuse.js
- `GET /api/v1/viz/evidence-matrix/`, `/viz/gap-map/`, `/viz/network/`, `/viz/timeline/`, `/viz/evidence-chain/`: pre-shaped data with filter params
- `GET /api/v1/stats/`: home page counts
- `POST /api/v1/papers/lookup-doi/`: Crossref lookup (server-side; handle timeouts gracefully)
- `POST /api/v1/import/bibtex/` and `/import/zotero-csv/`: parse + preview; `POST .../confirm/` to import
- `GET /api/v1/export/json/`, `/export/bibtex/`, `/export/ieee/`
- `GET /api/v1/<model>/<id>/history/` and `POST .../restore/<history_id>/`
- `POST /api/v1/uploads/`: images for the editor
- `GET/PUT /api/v1/settings/`
- Auth: `POST /api/v1/auth/login/`, `/logout/`, `GET /me/`, with CSRF cookie endpoint

Permissions: read is allowed only when logged in, unless `SiteSettings.public_read` is true. Write always requires login.

---

## 10. Seed data

Create a management command `python manage.py seed` that loads fixtures idempotently (safe to run twice).

- **Papers:** all 28 references from my attached A3 document, with citation numbers 1–28 and their exact IEEE reference strings. Use the A3 literature review text to fill in design, population, sample size, fluids, platform, review section, key finding and limitations for each paper.
- **Proteins:** every protein mentioned in the A3 text, including at least: TNF-α, TNF-R1, IL-6, IL-1α, IL-12, IL-17A, IL-18, IP-10, M-CSF, MCP-1 (alias CCL2), GRO-α, C1q, C3b, CRP, NfL (Olink assay NEFL), GFAP. Set NfL and GFAP role = comparator; all others = candidate.
- **Findings:** one Finding per paper–protein result described in the A3 text, e.g. elevated MCP-1/CCL2 in blood across studies [9]; IL-6 higher in FTLD than AD or controls [11]; baseline TNF-α higher in converters, AUC 0.72 [2]; TNF-α added to NfL raised AUC 0.80 to 0.88 [2]; IL-1α lower in presymptomatic carriers [13]; NfL higher at baseline in converters [14]; GFAP signal in GRN not C9orf72 carriers [28]. Only use what the text states.
- **Requirement assessments:** pre-fill from the A3 synthesis section where the text supports it; otherwise leave unset.
- **Docs pages:** create the sidebar from my A3:
  - *Overview*: Research question; Intended contributions
  - *Literature review*: Introduction; Peripheral inflammation in FTD; A signal before symptom onset; Added value beyond existing blood markers; A population setting and method to test it; Synthesis and research gap
  - *Methods*: Population and outcome; Biomarkers and comparators; Model development and validation; Performance and robustness
  - *Project*: Data policy (Section 11); How to use this site
  - Fill each page body with the corresponding A3 text, converting citation numbers to `{{cite:n}}` embeds.
- **Pipeline stages:** Data access; Cohort definition; FTD diagnostic-code algorithm; Event audit; Protein QC and missingness; Candidate set definition; Nested CV setup; Prediction horizon fixed; M1/M2/M3 comparison; Calibration; Sensitivity analyses; External validation plan; Write-up. All status = not_started.
- **Decisions:** seed the prespecified decisions stated in my A3 methods (e.g. M3 vs M2 as primary comparison; no univariable significance screening; preprocessing learned within training folds; horizon fixed after follow-up audit and before model comparison; 2- and 5-year exclusion sensitivity analyses), each with prespecified = true.
- **Log:** one first post, "Notebook set up", dated on the seed date.
- **SiteSettings:** title "FTD Inflammation Notebook", tagline "Can a minimal inflammatory panel predict incident FTD?"
- Write anything missing or uncertain to `SEED_DATA_TODO.md`.

---

## 11. Data policy (must be enforced in the product)

- This app must **never** hold UK Biobank participant-level data. Only protein names, panel annotations, literature, plans, decisions, notes and **permitted aggregate results** belong here.
- Seed a **Data policy** doc page explaining this, and link it in the footer.
- ResultEntry form: show a persistent warning banner about the policy. If `n_events` is below `SiteSettings.min_event_count_warning` (default 10, editable in settings), require me to tick a confirmation that the figure is permitted to be shown.
- Image uploads in the editor: show a one-line reminder not to upload outputs containing participant-level data.
- Do not add any feature for uploading CSVs of participant data. The only CSV upload is the Zotero literature import.

---

## 12. Quality, testing and operations

**Accessibility**
- WCAG 2.1 AA: keyboard navigation everywhere, visible focus states, ARIA labels on icon buttons, sufficient contrast in both themes, alt text on uploaded images (prompted in the editor).

**Performance**
- Code-split visualisation pages. TanStack Query caching with optimistic updates on edits.
- Visualisations should stay responsive with at least 300 papers, 200 proteins and 2,000 findings. Add a dev command to generate fake data at that scale for testing only (clearly marked fake, never mixed with seed data).

**Tests**
- Backend (pytest): models, serializers, permissions, filters, DOI lookup (mocked), BibTeX/CSV import, export formats, history restore, seed idempotency.
- Frontend (Vitest): Markdown renderer (admonitions, embeds, cite), editor ↔ Markdown round trip, filter logic.
- End-to-end (Playwright):
  1. Log in, add a paper by DOI, link it to two proteins via findings, and see it appear in the Evidence Matrix, Network and Protein pages without reloading.
  2. Edit a docs page in place, save, view history, restore the previous version.
  3. Write a log post with a `{{viz:...}}` embed and a `{{cite:n}}`, publish, and check it renders.
  4. Drag a pipeline stage to Done and see the progress bar update.
  5. Toggle dark mode and check it persists across reload.
  6. Mobile viewport: open the hamburger drawer and navigate the docs sidebar.

**Backups**
- `make backup` and a scheduled job (cron in Docker) that writes a nightly JSON export + database dump to a `backups/` volume, keeping the last 14.
- A "Download full backup" button in settings.

**Security**
- Django production checklist: `DEBUG=False`, secure cookies, HSTS, allowed hosts, secret key from env.
- Rate-limit the login endpoint. Sanitise rendered Markdown (no raw HTML execution).

---

## 13. Build phases

Each phase ends with passing tests, an updated README, and a commit.

**Phase 1: Backend foundation**
Django project, all models, migrations, admin registrations, DRF API with filters, auth, OpenAPI docs, seed command with all seed data.
*Done when:* `make seed` loads everything; `/api/docs/` lists all endpoints; Django admin can edit every model.

**Phase 2: Docusaurus-identical shell**
Vite + React + Infima. Navbar, footer, dark mode, mobile drawer, docs three-column layout, sidebar from API, breadcrumbs, TOC, prev/next, doc cards, Markdown renderer with admonitions, code blocks, tabs, details, and embeds. Home page hero.
*Done when:* side-by-side with a default Docusaurus 3 site, the layout, spacing and interactions match; all seeded docs pages render with working `{{cite:n}}` links.

**Phase 3: Editing everywhere**
Login, edit mode, BlockNote editor with all blocks and embed pickers, autosave drafts, version history and restore, structured forms for all models, Quick add, DOI lookup, BibTeX/Zotero import, exports, drag-and-drop ordering, soft delete and Trash.
*Done when:* I can do every content task from the browser, with no file or code edits; Playwright flows 1–2 pass.

**Phase 4: Papers, proteins and log**
Paper list (filterable table + card view), paper pages, protein list and protein profile pages, Log (blog) with tags, archive and pagination, search modal.
*Done when:* Playwright flow 3 passes; search finds items immediately after creation.

**Phase 5: Visualisations**
Evidence Matrix, Gap Map, Network, Timeline, Evidence Chain, Pipeline Board, Results Panel, embeds of each, PNG/SVG export.
*Done when:* all visualisations work with seed data and the fake large dataset; Playwright flow 4 passes.

**Phase 6: Production and polish**
Docker Compose (Django + gunicorn, Postgres, nginx serving the React build), backups, security settings, accessibility pass, performance pass, full README.
*Done when:* `docker compose up` gives a working production-like site; all tests and all six Playwright flows pass.

---

## 14. Deployment

Document in the README:
- **Local:** `make dev` runs Django and Vite together with hot reload.
- **Production-like local:** `docker compose up`.
- **Hosting options**, with step-by-step instructions for at least one: Render or Railway (Django + managed Postgres + static frontend), or a small VPS with Docker Compose and Caddy for automatic HTTPS.
- Environment variables needed, with an `.env.example`.
- How to restore from a backup.
- The README must state the data policy (Section 11) prominently near the top.

---

## 15. Definition of done (whole project)

- The site looks and behaves like a Docusaurus 3 classic-theme site, with my branding and the additions in Section 6.6.
- Every piece of content can be created, edited, reordered, versioned and deleted from the browser.
- All 28 A3 papers, the protein list, findings, docs pages, pipeline stages and prespecified decisions are seeded, with no invented data, and gaps are listed in `SEED_DATA_TODO.md`.
- All visualisations in Section 8 work, update live, support dark mode, and export to PNG/SVG.
- The data policy is visible and enforced as described.
- All tests pass, backups run, and the README lets someone set it up from scratch.
