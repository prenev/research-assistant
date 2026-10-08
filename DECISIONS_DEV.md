# Development decisions

Deviations from, or interpretations of, `PROMPT.md`.

1. **A3 document missing.** Not attached, so paper, finding, assessment and doc-body seed data is
   left empty and listed in `SEED_DATA_TODO.md` rather than invented.
2. **Seed never overwrites.** `seed` only creates missing rows, matched by title, slug or number.
   This makes it safe to run twice and safe to run after editing in the browser.
3. **Soft delete.** All editable models share `BaseModel` with `deleted_at`. The default manager
   hides trashed rows and `all_objects` shows them. Slugs stay unique across trashed rows, so a
   trashed item's slug cannot be reused until it is purged (`purge_trash`, 30 days).
4. **DocPage slugs are globally unique** (not per category), so `/docs/<slug>` is unambiguous.
5. **API lookup by numeric id**, per the spec's `/<model>/<id>/history/`. Slug lookups use the
   `?slug=` filter.
6. **JSON-list filter in Python.** `?fluid=` on papers is filtered in Python because SQLite has no
   JSON `contains`. This is fine at the target scale (300 papers).
7. **History tracks fields, not M2M.** `django-simple-history` versions model fields. Tag, linked
   paper and similar M2M changes are not versioned.
8. **`Decision.date` is nullable** because prespecification dates are not known until the A3 is
   supplied.
9. **Extra fields beyond the spec:** `ResultEntry.confirmed_permitted` (stores the data-policy
   tick), `DocPage.draft_body` and `LogPost.draft_body` (autosave), `Requirement.number/slug`,
   `Decision.slug`, `Paper.slug`, `SiteSettings.research_question`.
10. **Python 3.13 locally** (spec says 3.12+). `pyproject.toml` allows >=3.12.
11. **Endpoints deferred to their phases:** DOI lookup, BibTeX/CSV import, exports, uploads
    (Phase 3); `viz/*` (Phase 5). Phase 1 covers CRUD, filters, history/restore, auth, settings,
    stats, sidebar (+reorder) and search-index.
12. **Settings GET is public** so the app shell can load branding before login. It exposes only
    branding fields and `public_read`/`min_event_count_warning`.
13. **Admonition/tabs/details syntax is parsed by a small custom block parser** (`src/lib/markdown.ts`)
    rather than remark-directive, because Docusaurus's `:::note Title` form is not directive syntax.
    Tabs use `::tab Label` separators inside `:::tabs`; details use `:::details Summary`.
14. **Side-by-side check against a real Docusaurus 3 site was not possible** in this environment.
    The layout follows Infima and the classic theme's structure and was checked by screenshot only.
    Please compare against your own Docusaurus site.
15. **Login page doubles as the gate.** When the site is not public and you are logged out, the app
    shows the login form instead of per-request 403 errors.
16. **Primary colour shades** are derived in the browser from `primary_colour` (lightness offsets
    approximating Docusaurus's palette tool), with a lighter variant in dark mode.
17. **Editor model.** BlockNote stores nothing itself: content is converted to and from Markdown
    (`frontend/src/editor/convert.ts`). Simple admonitions are editable blocks. Details, tabs and
    admonitions containing lists or other structure are kept as exact source in a *Raw Markdown
    block*, so they are never altered. Citations and other embeds are inline chips. Images added in
    the editor ask for alt text. BlockNote's Mantine peer requires Mantine 8 on React 18.
18. **Form metadata via GET.** Dropdown choices come from the API (`/form-meta/<endpoint>/`) so enums
    are defined once. DRF's `OPTIONS` was not used because Vite's dev server answers `OPTIONS` itself.
19. **Autosave never touches the published body or history.** It writes only `draft_body`, and those
    saves skip version history.
20. **Phase 3 pages are deliberately minimal.** Papers, proteins, decisions and pipeline have simple
    list and detail pages so everything is editable now. Phase 4 and 5 rebuild them with filters,
    cards, charts and the kanban board.
21. **Flow 1 is completed in stages.** Phase 3 covers add paper by DOI, link two proteins through
    findings (one created inline), and checking the Papers and Protein pages without a reload.
    The Evidence Matrix and Network checks need Phase 5 and will be added then. Crossref is mocked
    in the test because it is not reachable from the test environment.
22. **Log posts** can be created and edited through forms now, but have no reading pages until
    Phase 4, which also adds in-place log editing.
23. **Uploads** accept JPEG, PNG, GIF and WebP only (validated with Pillow, max 10 MB). SVG is
    rejected because it can carry scripts.
24. **Hosting: one free service.** Django serves the API, the built React app (via WhiteNoise and a
    catch-all for client-side routes), `/media/` and the admin, so it fits a single free web service.
    Neon (not Render) provides Postgres because Render's free database expires after 30 days.
    Uploaded images are on the host's ephemeral disk and are lost on redeploy (documented in
    `DEPLOY.md`). The account is created from `OWNER_USERNAME` / `OWNER_PASSWORD` so no shell is needed.
    The Docker Compose / nginx / nightly-backup setup from Phase 6 is still to do.
