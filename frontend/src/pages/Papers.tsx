import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useList, type Obj } from "../api/crud";
import { Badge, humanise } from "../components/Badge";
import { useFeedback } from "../components/Feedback";
import { ItemActions } from "../components/ItemActions";
import { PageShell } from "../components/PageShell";
import { Markdown } from "../components/Markdown";
import { useForms } from "../forms/FormHost";
import { useEditMode } from "../theme/EditMode";
import { FindingsTable } from "./Proteins";

export function PapersPage() {
  const { data: papers, isLoading } = useList("papers");
  const { editing } = useEditMode();
  const { openForm, openImport } = useForms();
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (papers ?? []).filter(
      (p) =>
        !n ||
        `${p.title} ${p.authors} ${p.journal} ${p.doi ?? ""}`
          .toLowerCase()
          .includes(n),
    );
  }, [papers, q]);
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
      <input
        className="field margin-bottom--md"
        placeholder="Filter papers…"
        aria-label="Filter papers"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isLoading ? (
        <p>Loading…</p>
      ) : shown.length === 0 ? (
        <div className="alert alert--info">
          {papers?.length
            ? "No papers match your filter."
            : "No papers yet. Use ＋ in the navbar to add one by DOI, or import a BibTeX or Zotero file."}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>[n]</th>
                <th>Paper</th>
                <th>Design</th>
                <th>Population</th>
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
      )}
    </PageShell>
  );
}

export function PaperPage() {
  const { slug } = useParams();
  const { data, isLoading } = useList("papers", { slug });
  const paper = data?.[0];
  const { data: findings } = useList("findings", { paper: paper?.id });
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
  return (
    <PageShell
      title={paper.title}
      actions={<ItemActions model="paper" item={paper} size="md" />}
    >
      <p>
        <Badge value={paper.reading_status} /> {paper.authors}
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
    </PageShell>
  );
}

export type { Obj };
