import { useQueryClient } from "@tanstack/react-query";
import { useState, type DragEvent } from "react";
import { api, post } from "../api/client";
import { refreshAfterWrite, useFormMeta, useList, type Obj } from "../api/crud";
import { Badge } from "../components/Badge";
import { useFeedback } from "../components/Feedback";
import { ItemActions } from "../components/ItemActions";
import { Markdown } from "../components/Markdown";
import { PageShell } from "../components/PageShell";
import { useForms } from "../forms/FormHost";
import { useEditMode } from "../theme/EditMode";

/** Phase 3: list with status changes and reordering. The kanban board and stepper come in Phase 5. */
export function PipelinePage() {
  const { data: stages, isLoading } = useList("pipeline-stages");
  const { data: meta } = useFormMeta("pipeline-stages");
  const { editing } = useEditMode();
  const { openForm } = useForms();
  const { toast } = useFeedback();
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<number | null>(null);
  const done = stages?.filter((s) => s.status === "done").length ?? 0;
  const pct = stages?.length ? Math.round((100 * done) / stages.length) : 0;

  const reorder = async (ids: number[]) => {
    qc.setQueryData(
      ["list", "pipeline-stages", {}],
      (old: Obj[] | undefined) =>
        old ? ids.map((id) => old.find((s) => s.id === id)!) : old,
    );
    try {
      await post("/pipeline-stages/reorder/", { ids });
    } catch {
      toast("Could not save the new order", "error");
    }
    refreshAfterWrite(qc);
  };
  const step = (i: number, d: -1 | 1) => {
    if (!stages) return;
    const ids = stages.map((s) => s.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder(ids);
  };
  const drop = (e: DragEvent, overId: number) => {
    e.preventDefault();
    if (dragId === null || dragId === overId || !stages) return;
    const ids = stages.map((s) => s.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(overId), 0, dragId);
    reorder(ids);
    setDragId(null);
  };
  const setStatus = async (s: Obj, status: string) => {
    try {
      await api(`/pipeline-stages/${s.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      refreshAfterWrite(qc);
    } catch {
      toast("Could not update the status", "error");
    }
  };

  return (
    <PageShell
      title="Pipeline"
      actions={
        editing && (
          <button
            type="button"
            className="button button--primary button--sm"
            onClick={() => openForm("pipelineStage")}
          >
            Add stage
          </button>
        )
      }
    >
      <div className="progress-wrap" aria-label={`Pipeline progress ${pct}%`}>
        <div className="progress">
          <div className="progress__bar" style={{ width: `${pct}%` }} />
        </div>
        <span>
          {pct}% done ({done} of {stages?.length ?? 0})
        </span>
      </div>
      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <ol className="stage-list">
          {stages?.map((s, i) => (
            <li
              key={s.id}
              className={`stage card padding--md${dragId === s.id ? " stage--drag" : ""}`}
              draggable={editing}
              onDragStart={() => setDragId(s.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => editing && e.preventDefault()}
              onDrop={(e) => drop(e, s.id)}
            >
              <div className="stage__head">
                <strong>
                  {i + 1}. {s.title}
                </strong>
                {editing ? (
                  <select
                    aria-label={`Status of ${s.title}`}
                    className="field field--inline"
                    value={s.status}
                    onChange={(e) => setStatus(s, e.target.value)}
                  >
                    {meta?.status?.choices?.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.display_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge value={s.status} />
                )}
                {editing && (
                  <span className="sidebar-edit">
                    <button
                      type="button"
                      className="clean-btn"
                      aria-label={`Move ${s.title} up`}
                      onClick={() => step(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="clean-btn"
                      aria-label={`Move ${s.title} down`}
                      onClick={() => step(i, 1)}
                    >
                      ↓
                    </button>
                  </span>
                )}
                <ItemActions model="pipelineStage" item={s} />
              </div>
              {(s.started_on || s.completed_on) && (
                <small>
                  {s.started_on && `Started ${s.started_on}`}
                  {s.completed_on && ` · Completed ${s.completed_on}`}
                </small>
              )}
              {s.blocked_reason && (
                <div className="alert alert--danger margin-top--sm">
                  Blocked: {s.blocked_reason}
                </div>
              )}
              {s.description && <Markdown source={s.description} />}
            </li>
          ))}
        </ol>
      )}
    </PageShell>
  );
}
