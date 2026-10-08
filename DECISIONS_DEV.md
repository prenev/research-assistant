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
