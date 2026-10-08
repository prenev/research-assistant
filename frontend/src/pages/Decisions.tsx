import { useList } from "../api/crud";
import { Badge } from "../components/Badge";
import { ItemActions } from "../components/ItemActions";
import { Markdown } from "../components/Markdown";
import { PageShell } from "../components/PageShell";
import { useForms } from "../forms/FormHost";
import { useEditMode } from "../theme/EditMode";

export function DecisionsPage() {
  const { data, isLoading } = useList("decisions");
  const { editing } = useEditMode();
  const { openForm } = useForms();
  return (
    <PageShell
      title="Decisions"
      actions={
        editing && (
          <button
            type="button"
            className="button button--primary button--sm"
            onClick={() => openForm("decision")}
          >
            New decision
          </button>
        )
      }
    >
      {isLoading ? (
        <p>Loading…</p>
      ) : !data?.length ? (
        <div className="alert alert--info">No decisions yet.</div>
      ) : (
        data.map((d) => (
          <section
            key={d.id}
            id={d.slug}
            className="card padding--md margin-bottom--md"
          >
            <div className="page-header">
              <h2 className="margin-bottom--none">{d.title}</h2>
              <ItemActions model="decision" item={d} />
            </div>
            <p className="margin-vert--sm">
              <Badge value={d.status} />{" "}
              {d.prespecified ? (
                <span className="badge badge--primary">Prespecified</span>
              ) : (
                <span className="badge badge--secondary">Not prespecified</span>
              )}{" "}
              <small>{d.date ?? "date not recorded"}</small>
            </p>
            {d.decision && <p>{d.decision}</p>}
            {d.rationale && <Markdown source={d.rationale} />}
          </section>
        ))
      )}
    </PageShell>
  );
}
