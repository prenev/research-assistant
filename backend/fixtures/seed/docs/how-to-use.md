This is a personal research notebook. Everything is edited from the browser, so you never need to touch code or files.

## Content types

- **Docs**: the sidebar pages (research question, literature review, methods, project notes)
- **Papers** and **Proteins**, linked through **Findings** (one finding per paper–protein result)
- **Log**: dated notes in blog form
- **Pipeline**: analysis stages and their status
- **Decisions**: analysis decisions, with whether they were prespecified

## Embeds

| Shortcode | Renders |
|---|---|
| `{{cite:1}}` or `{{cite:1,2}}` | IEEE-style `[1]`, `[1], [2]`, linking to the paper |
| `{{paper:slug}}` | Paper chip with hover card |
| `{{protein:slug}}` | Protein chip linking to its page |
| `{{viz:evidence-matrix population=general_population}}` | A visualisation, optionally filtered |

:::info Build status
The editing interface and visualisations arrive in later build phases. Until then, content is managed through the API and the Django admin.
:::
