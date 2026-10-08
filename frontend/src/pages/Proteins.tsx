import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useFormMeta, useList, type Obj } from "../api/crud";
import { BarChart, countBy } from "../components/Charts";
import { FilterBar } from "../components/FilterBar";
import { ProteinInfoButton, ProteinInfoPanel } from "../components/ProteinInfo";
import { readParams, sortBy, withParam } from "../lib/params";
import { Badge, humanise } from "../components/Badge";
import { ItemActions } from "../components/ItemActions";
import { Markdown } from "../components/Markdown";
import { PageShell } from "../components/PageShell";
import { useForms } from "../forms/FormHost";
import { useEditMode } from "../theme/EditMode";

const ICON: Record<string, string> = {
  raised: "▲",
  lowered: "▼",
  no_difference: "○",
  associated: "◆",
  not_associated: "◇",
  predictive: "★",
  not_predictive: "☆",
  mixed: "◐",
};

export function FindingsTable({
  findings,
  show,
}: {
  findings: Obj[];
  show: "protein" | "paper";
}) {
  if (findings.length === 0)
    return <p className="table-sub">No findings recorded yet.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{show === "protein" ? "Protein" : "Paper"}</th>
            <th>Direction</th>
            <th>Context</th>
            <th>Effect</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => (
            <tr key={f.id}>
              <td>
                {show === "protein" ? (
                  <Link to={`/proteins/${f.protein_slug}`}>
                    {f.protein_name}
                  </Link>
                ) : (
                  <Link to={`/papers/${f.paper_slug}`}>{f.paper_label}</Link>
                )}
              </td>
              <td>
                <span aria-hidden="true">{ICON[f.direction]} </span>
                {humanise(f.direction)}
              </td>
              <td>
                {f.context_detail || humanise(f.context)}
                {f.subgroup && <div className="table-sub">{f.subgroup}</div>}
              </td>
              <td>{f.effect}</td>
              <td>
                <ItemActions model="finding" item={f} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProteinsPage() {
  const [sp, setSp] = useSearchParams();
  const values = readParams(sp, ["category", "role"]);
  const q = sp.get("q") ?? "";
  const { data: proteins, isLoading } = useList("proteins", values);
  const { data: meta } = useFormMeta("proteins");
  const { editing } = useEditMode();
  const { openForm } = useForms();
  const [sort, setSort] = useState<"name" | "finding_count">("name");
  const choice = (n: string) =>
    (meta?.[n]?.choices ?? []).map((c) => ({
      value: c.value,
      label: c.display_name,
    }));
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    const f = (proteins ?? []).filter(
      (p) =>
        !n ||
        `${p.name} ${(p.aliases ?? []).join(" ")} ${p.olink_assay_name}`
          .toLowerCase()
          .includes(n),
    );
    return sort === "name"
      ? sortBy(f, (p) => p.name.toLowerCase())
      : sortBy(f, (p) => p.finding_count, -1);
  }, [proteins, q, sort]);
  return (
    <PageShell
      title="Proteins"
      actions={
        editing && (
          <button
            type="button"
            className="button button--primary button--sm"
            onClick={() => openForm("protein")}
          >
            Add protein
          </button>
        )
      }
    >
      <FilterBar
        filters={[
          { name: "category", label: "Category", options: choice("category") },
          { name: "role", label: "Role", options: choice("role") },
        ]}
        values={values}
        onChange={(n, v) => setSp(withParam(sp, n, v))}
        onClear={() => setSp(new URLSearchParams())}
      >
        <label className="filter-bar__item filter-bar__item--grow">
          <span>Search</span>
          <input
            className="field"
            placeholder="Name, alias or Olink assay…"
            value={q}
            onChange={(e) => setSp(withParam(sp, "q", e.target.value))}
          />
        </label>
      </FilterBar>
      <div className="list-toolbar">
        <span role="status">
          {isLoading
            ? "Loading…"
            : `${shown.length} protein${shown.length === 1 ? "" : "s"}`}
        </span>
        <label className="filter-bar__item">
          <span>Sort by</span>
          <select
            className="field field--inline"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="name">Name</option>
            <option value="finding_count">Most findings</option>
          </select>
        </label>
      </div>
      {isLoading ? null : !shown.length ? (
        <div className="alert alert--info">
          {proteins?.length
            ? "No proteins match these filters."
            : "No proteins yet."}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Protein</th>
                <th>Category</th>
                <th>Role</th>
                <th>Olink assay</th>
                <th>Findings</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/proteins/${p.slug}`}>
                      <strong>{p.name}</strong>
                    </Link>
                    {p.aliases?.length > 0 && (
                      <div className="table-sub">{p.aliases.join(", ")}</div>
                    )}
                  </td>
                  <td>{humanise(p.category)}</td>
                  <td>
                    <Badge value={p.role} />
                  </td>
                  <td>{p.olink_assay_name}</td>
                  <td>{p.finding_count}</td>
                  <td>
                    <ProteinInfoButton protein={p as never} />
                  </td>
                  <td>
                    <ItemActions model="protein" item={p} />
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

export function ProteinPage() {
  const { slug } = useParams();
  const { data, isLoading } = useList("proteins", { slug });
  const protein = data?.[0];
  const { data: findings } = useList("findings", { protein: slug });
  const { data: posts } = useList("log-posts");
  const { data: decisions } = useList("decisions");
  const { editing } = useEditMode();
  const { openForm } = useForms();
  if (isLoading)
    return (
      <PageShell title="Protein">
        <p>Loading…</p>
      </PageShell>
    );
  if (!protein)
    return (
      <PageShell title="Protein not found">
        <Link to="/proteins">Back to proteins</Link>
      </PageShell>
    );
  const names = [protein.name, ...(protein.aliases ?? [])].map((n: string) =>
    n.toLowerCase(),
  );
  const mentions = (d: Obj) => {
    const text = `${d.title} ${d.decision} ${d.rationale}`.toLowerCase();
    return names.some((n: string) => n.length > 2 && text.includes(n));
  };
  const myPosts = (posts ?? []).filter((p) =>
    p.linked_proteins.includes(protein.id),
  );
  const myDecisions = (decisions ?? []).filter(mentions);
  const f = findings ?? [];
  return (
    <PageShell
      title={protein.name}
      actions={<ItemActions model="protein" item={protein} size="md" />}
    >
      <p>
        <Badge value={protein.category} /> <Badge value={protein.role} />
        {protein.aliases?.length > 0 && (
          <> · Also: {protein.aliases.join(", ")}</>
        )}
        {protein.olink_assay_name && (
          <>
            {" "}
            · Olink assay: <code>{protein.olink_assay_name}</code>
          </>
        )}
        {protein.on_olink_panel && <> · Panel: {protein.on_olink_panel}</>}
      </p>
      {protein.exclusion_reason && (
        <div className="alert alert--danger">
          Excluded: {protein.exclusion_reason}
        </div>
      )}
      {protein.rationale && (
        <>
          <h2>Rationale</h2>
          <Markdown source={protein.rationale} />
        </>
      )}
      {protein.notes && (
        <>
          <h2>Notes</h2>
          <Markdown source={protein.notes} />
        </>
      )}
      <h2>About this protein</h2>
      <ProteinInfoPanel protein={protein as never} />
      <h2>Evidence</h2>
      {f.length > 0 && (
        <div className="row margin-bottom--md">
          <div className="col col--6">
            <BarChart
              title="Findings by direction"
              data={countBy(f, (x) => x.direction, humanise)}
            />
          </div>
          <div className="col col--6">
            <BarChart
              title="Findings by population"
              data={countBy(f, (x) => x.paper_population, humanise)}
            />
          </div>
        </div>
      )}
      {editing && (
        <button
          type="button"
          className="button button--primary button--sm margin-bottom--sm"
          onClick={() =>
            openForm("finding", { initial: { protein: protein.id } })
          }
        >
          Add finding
        </button>
      )}
      <FindingsTable findings={f} show="paper" />
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
      {myDecisions.length > 0 && (
        <>
          <h2>Decisions mentioning {protein.name}</h2>
          <ul>
            {myDecisions.map((d) => (
              <li key={d.id}>
                <Link to={`/decisions#${d.slug}`}>{d.title}</Link>{" "}
                <Badge value={d.status} />
              </li>
            ))}
          </ul>
        </>
      )}
    </PageShell>
  );
}
