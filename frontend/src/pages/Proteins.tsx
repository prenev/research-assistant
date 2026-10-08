import { Link, useParams } from "react-router-dom";
import { useList, type Obj } from "../api/crud";
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
                  <span>{f.paper_label}</span>
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
  const { data: proteins, isLoading } = useList("proteins");
  const { editing } = useEditMode();
  const { openForm } = useForms();
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
      {isLoading ? (
        <p>Loading…</p>
      ) : !proteins?.length ? (
        <div className="alert alert--info">No proteins yet.</div>
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
              {proteins.map((p) => (
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
      <h2>Findings</h2>
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
      <FindingsTable findings={findings ?? []} show="paper" />
    </PageShell>
  );
}
