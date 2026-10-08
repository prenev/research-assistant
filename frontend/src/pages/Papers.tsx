import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useFormMeta, useList, type Obj } from "../api/crud";
import { Badge, humanise } from "../components/Badge";
import { useFeedback } from "../components/Feedback";
import { FilterBar, type FilterDef } from "../components/FilterBar";
import { ItemActions } from "../components/ItemActions";
import { Markdown } from "../components/Markdown";
import { PageShell } from "../components/PageShell";
import { useForms } from "../forms/FormHost";
import { readParams, sortBy, withParam } from "../lib/params";
import { useEditMode } from "../theme/EditMode";
import { FindingsTable } from "./Proteins";

const FILTER_NAMES = [
  "population",
  "design",
  "reading_status",
  "review_section",
  "fluid",
  "protein",
  "tag",
];
type SortKey = "citation_number" | "short_label" | "year" | "sample_size";

function useView() {
  const [view, setView] = useState<"table" | "cards">(() => {
    try {
      return localStorage.getItem("papersView") === "cards" ? "cards" : "table";
    } catch {
      return "table";
    }
  });
  const set = (v: "table" | "cards") => {
    setView(v);
    try {
      localStorage.setItem("papersView", v);
    } catch {
      /* storage unavailable */
    }
  };
  return [view, set] as const;
}

export function PapersPage() {
  const [sp, setSp] = useSearchParams();
  const values = readParams(sp, FILTER_NAMES);
  const q = sp.get("q") ?? "";
  const yearMin = sp.get("year_min") ?? "";
  const yearMax = sp.get("year_max") ?? "";
  const params = { ...values, year_min: yearMin, year_max: yearMax };
  const { data: papers, isLoading } = useList("papers", params);
  const { data: meta } = useFormMeta("papers");
  const { data: proteins } = useList("proteins");
  const { data: tags } = useList("tags");
  const { editing } = useEditMode();
  const { openForm, openImport } = useForms();
  const [view, setView] = useView();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "citation_number",
    dir: 1,
  });

  const choice = (name: string) =>
    (meta?.[name]?.choices ?? []).map((c) => ({
      value: c.value,
      label: c.display_name,
    }));
  const filters: FilterDef[] = [
    { name: "population", label: "Population", options: choice("population") },
    { name: "design", label: "Design", options: choice("design") },
    {
      name: "reading_status",
      label: "Status",
      options: choice("reading_status"),
    },
    {
      name: "review_section",
      label: "Review section",
      options: choice("review_section"),
    },
    {
      name: "fluid",
      label: "Fluid",
      options: [
        ["plasma", "Plasma"],
        ["serum", "Serum"],
        ["csf", "CSF"],
        ["brain_tissue", "Brain tissue"],
        ["pet_imaging", "PET imaging"],
      ].map(([value, label]) => ({ value, label })),
    },
    {
      name: "protein",
      label: "Protein",
      options: (proteins ?? []).map((p) => ({ value: p.slug, label: p.name })),
    },
    {
      name: "tag",
      label: "Tag",
      options: (tags ?? []).map((t) => ({ value: t.slug, label: t.name })),
    },
  ];

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    const filtered = (papers ?? []).filter(
      (p) =>
        !n ||
        `${p.title} ${p.authors} ${p.journal} ${p.doi ?? ""} ${p.key_finding}`
          .toLowerCase()
          .includes(n),
    );
    return sortBy(
      filtered,
      (p) =>
        sort.key === "short_label" ? p.short_label?.toLowerCase() : p[sort.key],
      sort.dir,
    );
  }, [papers, q, sort]);

  const th = (key: SortKey, label: string) => (
    <th
      aria-sort={
        sort.key === key
          ? sort.dir === 1
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        className="clean-btn th-sort"
        onClick={() =>
          setSort((s) => ({ key, dir: s.key === key && s.dir === 1 ? -1 : 1 }))
        }
      >
        {label} {sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : ""}
      </button>
    </th>
  );
  const anyFilter =
    Object.values(values).some(Boolean) || q || yearMin || yearMax;

  return (
    <PageShell
      title="Papers"
      actions={
        <>
          <a
            className="button button--secondary button--sm"
            href="/api/v1/export/bibtex/"
          >
            Export BibTeX
          </a>
          <a
            className="button button--secondary button--sm"
            href="/api/v1/export/ieee/"
          >
            Export IEEE list
          </a>
          {editing && (
            <>
              <button
                type="button"
                className="button button--secondary button--sm"
                onClick={openImport}
              >
                Import…
              </button>
              <button
                type="button"
                className="button button--primary button--sm"
                onClick={() => openForm("paper")}
              >
                Add paper
              </button>
            </>
          )}
        </>
      }
    >
      <FilterBar
        filters={filters}
        values={values}
        onChange={(n, v) => setSp(withParam(sp, n, v))}
        onClear={() => setSp(new URLSearchParams())}
      >
        <label className="filter-bar__item filter-bar__item--grow">
          <span>Search</span>
          <input
            className="field"
            placeholder="Title, author, journal, DOI…"
            value={q}
            onChange={(e) => setSp(withParam(sp, "q", e.target.value))}
          />
        </label>
        <label className="filter-bar__item">
          <span>Year from</span>
          <input
            className="field field--year"
            type="number"
            value={yearMin}
            onChange={(e) => setSp(withParam(sp, "year_min", e.target.value))}
          />
        </label>
        <label className="filter-bar__item">
          <span>to</span>
          <input
            className="field field--year"
            type="number"
            value={yearMax}
            onChange={(e) => setSp(withParam(sp, "year_max", e.target.value))}
          />
        </label>
      </FilterBar>

      <div className="list-toolbar">
        <span role="status">
          {isLoading
            ? "Loading…"
            : `${shown.length} paper${shown.length === 1 ? "" : "s"}${anyFilter ? " match" : ""}`}
        </span>
        <div className="button-group" role="group" aria-label="View">
          <button
            type="button"
            className={`button button--sm ${view === "table" ? "button--primary" : "button--secondary"}`}
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            Table
          </button>
          <button
            type="button"
            className={`button button--sm ${view === "cards" ? "button--primary" : "button--secondary"}`}
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
          >
            Cards
          </button>
        </div>
      </div>

      {!isLoading && shown.length === 0 ? (
        <div className="alert alert--info">
          {anyFilter
            ? "No papers match these filters."
            : "No papers yet. Use ＋ in the navbar to add one by DOI, or import a BibTeX or Zotero file."}
        </div>
      ) : view === "table" ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {th("citation_number", "[n]")}
                {th("short_label", "Paper")}
                <th>Design</th>
                <th>Population</th>
                {th("sample_size", "n")}
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>{p.citation_number ?? ""}</td>
                  <td>
                    <Link to={`/papers/${p.slug}`}>
                      <strong>{p.short_label || "Untitled"}</strong>
                    </Link>
                    <div className="table-sub">{p.title}</div>
                  </td>
                  <td>{humanise(p.design)}</td>
                  <td>{humanise(p.population)}</td>
                  <td>{p.sample_size ?? ""}</td>
                  <td>
                    <Badge value={p.reading_status} />
                  </td>
                  <td>
                    <ItemActions model="paper" item={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="row">
          {shown.map((p) => (
            <div key={p.id} className="col col--4 margin-bottom--lg">
              <article className="card paper-card">
                <div className="card__header">
                  <h3>
                    <Link to={`/papers/${p.slug}`}>
                      {p.short_label || "Untitled"}
                      {p.citation_number ? ` [${p.citation_number}]` : ""}
                    </Link>
                  </h3>
                  <div className="table-sub">{p.title}</div>
                </div>
                <div className="card__body">
                  {p.key_finding && <p>{p.key_finding}</p>}
                  <p className="paper-card__badges">
                    <span className="badge badge--secondary">
                      {humanise(p.design)}
                    </span>{" "}
                    <span className="badge badge--secondary">
                      {humanise(p.population)}
                    </span>{" "}
                    <Badge value={p.reading_status} />
                  </p>
                </div>
                <div className="card__footer">
                  <ItemActions model="paper" item={p} />
                </div>
              </article>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}

export function PaperPage() {
  const { slug } = useParams();
  const { data, isLoading } = useList("papers", { slug });
  const paper = data?.[0];
  const { data: findings } = useList("findings", { paper: paper?.id });
  const { data: assessments } = useList("requirement-assessments", {
    paper: paper?.id,
  });
  const { data: requirements } = useList("requirements");
  const { data: posts } = useList("log-posts");
  const { data: tags } = useList("tags");
  const { editing } = useEditMode();
  const { openForm } = useForms();
  const { toast } = useFeedback();
  if (isLoading)
    return (
      <PageShell title="Paper">
        <p>Loading…</p>
      </PageShell>
    );
  if (!paper)
    return (
      <PageShell title="Paper not found">
        <Link to="/papers">Back to papers</Link>
      </PageShell>
    );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(paper.ieee_reference);
      toast("Reference copied");
    } catch {
      toast("Could not copy", "error");
    }
  };
  const meta: [string, React.ReactNode][] = [
    [
      "Journal",
      [
        paper.journal,
        paper.volume && `vol. ${paper.volume}`,
        paper.issue && `no. ${paper.issue}`,
        paper.pages && `pp. ${paper.pages}`,
      ]
        .filter(Boolean)
        .join(", "),
    ],
    ["Year", paper.year],
    [
      "DOI",
      paper.doi ? (
        <a
          href={`https://doi.org/${paper.doi}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {paper.doi}
        </a>
      ) : (
        ""
      ),
    ],
    ["Design", humanise(paper.design)],
    ["Population", humanise(paper.population)],
    [
      "Sample size",
      [paper.sample_size, paper.sample_size_note].filter(Boolean).join(" · "),
    ],
    ["Fluids", (paper.fluids ?? []).map(humanise).join(", ")],
    ["Platform", humanise(paper.platform)],
    ["Review section", humanise(paper.review_section)],
  ];
  const reqById = new Map((requirements ?? []).map((r: Obj) => [r.id, r]));
  const myPosts = (posts ?? []).filter((p) =>
    p.linked_papers.includes(paper.id),
  );
  const myTags = (tags ?? []).filter((t) => paper.tags.includes(t.id));
  return (
    <PageShell
      title={paper.title}
      actions={<ItemActions model="paper" item={paper} size="md" />}
    >
      <p>
        <Badge value={paper.reading_status} /> {paper.authors}{" "}
        {myTags.map((t) => (
          <span key={t.id} className="tag-pill">
            {t.name}
          </span>
        ))}
      </p>
      {paper.ieee_reference && (
        <div className="reference-box">
          <span>
            {paper.citation_number ? `[${paper.citation_number}] ` : ""}
            {paper.ieee_reference}
          </span>
          <button
            type="button"
            className="button button--secondary button--sm"
            onClick={copy}
          >
            Copy
          </button>
        </div>
      )}
      <div className="table-wrap margin-vert--md">
        <table>
          <tbody>
            {meta
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {paper.key_finding && (
        <Markdown source={`:::tip Key finding\n${paper.key_finding}\n:::`} />
      )}
      {paper.limitations?.length > 0 && (
        <Markdown
          source={`:::warning Limitations\n${paper.limitations.map((l: string) => `- ${l}`).join("\n")}\n:::`}
        />
      )}
      {paper.notes && (
        <>
          <h2>Notes</h2>
          <Markdown source={paper.notes} />
        </>
      )}
      <h2>Findings</h2>
      {editing && (
        <button
          type="button"
          className="button button--primary button--sm margin-bottom--sm"
          onClick={() => openForm("finding", { initial: { paper: paper.id } })}
        >
          Add finding
        </button>
      )}
      <FindingsTable findings={findings ?? []} show="protein" />
      {assessments && assessments.length > 0 && (
        <>
          <h2>Synthesis requirements</h2>
          <ul className="assessments">
            {assessments.map((a) => (
              <li key={a.id}>
                <strong>
                  R{reqById.get(a.requirement)?.number}:{" "}
                  {reqById.get(a.requirement)?.title}
                </strong>{" "}
                <span
                  className={`badge badge--${a.met === "yes" ? "success" : a.met === "partial" ? "warning" : "danger"}`}
                >
                  {humanise(a.met)}
                </span>
                {a.justification && (
                  <div className="table-sub">{a.justification}</div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {myPosts.length > 0 && (
        <>
          <h2>Log posts</h2>
          <ul>
            {myPosts.map((p) => (
              <li key={p.id}>
                <Link to={`/log/${p.slug}`}>{p.title}</Link>{" "}
                <small>{p.date}</small>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageShell>
  );
}

export type { Obj };
