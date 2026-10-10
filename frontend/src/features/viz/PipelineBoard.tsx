import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../api/client";
import {
  refreshAfterWrite,
  useFormMeta,
  useList,
  type Obj,
} from "../../api/crud";
import { useMe } from "../../api/hooks";
import { Badge } from "../../components/Badge";
import { useFeedback } from "../../components/Feedback";
import { Modal } from "../../components/Modal";
import { SvgTable } from "./SvgTable";
import { VizFrame } from "./VizFrame";

const COLUMNS = [
  { status: "not_started", title: "Not started", icon: "○" },
  { status: "in_progress", title: "In progress", icon: "●" },
  { status: "blocked", title: "Blocked", icon: "!" },
  { status: "done", title: "Done", icon: "✓" },
];

export function PipelineBoard({
  embedded,
  readOnly,
}: {
  embedded?: boolean;
  readOnly?: boolean;
}) {
  const { data: stages, isLoading } = useList("pipeline-stages");
  const { data: meta } = useFormMeta("pipeline-stages");
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { toast } = useFeedback();
  const [view, setView] = useState<"board" | "timeline">("board");
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<Obj | null>(null);
  const [reason, setReason] = useState("");
  const canEdit = !!me?.authenticated && !readOnly;

  const list = stages ?? [];
  const done = list.filter((s) => s.status === "done").length;
  const pct = list.length ? Math.round((100 * done) / list.length) : 0;

  const move = async (stage: Obj, status: string, blocked_reason = "") => {
    if (stage.status === status) return;
    qc.setQueryData(["list", "pipeline-stages", {}], (old: Obj[] | undefined) =>
      old?.map((s) => (s.id === stage.id ? { ...s, status } : s)),
    );
    try {
      await api(`/pipeline-stages/${stage.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status, blocked_reason }),
      });
      toast(
        `“${stage.title}” moved to ${COLUMNS.find((c) => c.status === status)?.title}`,
      );
    } catch {
      toast("Could not move that step", "error");
    }
    refreshAfterWrite(qc);
  };
  const request = (stage: Obj, status: string) => {
    if (status === "blocked") {
      setBlocking(stage);
      setReason(stage.blocked_reason ?? "");
    } else void move(stage, status);
  };

  return (
    <VizFrame
      title="Pipeline"
      description="The steps of the analysis. Drag a card to change its status."
      fileName="pipeline"
      embedded={embedded}
      empty={!isLoading && list.length === 0}
      emptyHint="Pipeline steps appear here."
      tools={
        <div className="button-group" role="group" aria-label="View">
          <button
            type="button"
            className={`button button--sm ${view === "board" ? "button--primary" : "button--secondary"}`}
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
          >
            Board
          </button>
          <button
            type="button"
            className={`button button--sm ${view === "timeline" ? "button--primary" : "button--secondary"}`}
            aria-pressed={view === "timeline"}
            onClick={() => setView("timeline")}
          >
            Timeline
          </button>
        </div>
      }
    >
      <div
        className="progress-wrap"
        role="img"
        aria-label={`Pipeline ${pct}% done, ${done} of ${list.length} steps`}
      >
        <div className="progress">
          <div className="progress__bar" style={{ width: `${pct}%` }} />
        </div>
        <strong>{pct}% done</strong>{" "}
        <span>
          ({done} of {list.length})
        </span>
      </div>
      {isLoading ? (
        <p>Loading…</p>
      ) : view === "board" ? (
        <div className="board">
          {COLUMNS.map((col) => {
            const items = list.filter((s) => s.status === col.status);
            return (
              <div
                key={col.status}
                className={`board__col${over === col.status ? " board__col--over" : ""}`}
                onDragOver={(e) =>
                  canEdit && (e.preventDefault(), setOver(col.status))
                }
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const s = list.find((x) => x.id === dragId);
                  if (s) request(s, col.status);
                  setDragId(null);
                }}
                role="group"
                aria-label={`${col.title}, ${items.length} steps`}
              >
                <h3>
                  <span>
                    <span aria-hidden="true">{col.icon}</span> {col.title}
                  </span>
                  <span>{items.length}</span>
                </h3>
                {items.map((s) => (
                  <div
                    key={s.id}
                    className="board__card"
                    draggable={canEdit}
                    onDragStart={() => setDragId(s.id)}
                    onDragEnd={() => setDragId(null)}
                  >
                    <strong>{s.title}</strong>
                    {s.blocked_reason && (
                      <div className="table-sub">
                        Blocked: {s.blocked_reason}
                      </div>
                    )}
                    {s.completed_on && (
                      <div className="table-sub">Done {s.completed_on}</div>
                    )}
                    {canEdit && (
                      <select
                        aria-label={`Move ${s.title} to`}
                        value={s.status}
                        onChange={(e) => request(s, e.target.value)}
                      >
                        {(
                          meta?.status?.choices ??
                          COLUMNS.map((c) => ({
                            value: c.status,
                            display_name: c.title,
                          }))
                        ).map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.display_name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <ol className="stage-list">
          {list.map((s, i) => (
            <li key={s.id} className="stage card padding--md">
              <div className="stage__head">
                <span aria-hidden="true">
                  {COLUMNS.find((c) => c.status === s.status)?.icon}
                </span>
                <strong>
                  {i + 1}. {s.title}
                </strong>
                <Badge value={s.status} />
              </div>
              <small>
                {s.started_on ? `Started ${s.started_on}` : "Not started"}
                {s.completed_on ? ` · Completed ${s.completed_on}` : ""}
              </small>
              {s.blocked_reason && (
                <div className="alert alert--danger margin-top--sm">
                  Blocked: {s.blocked_reason}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <SvgTable
        title={`Pipeline: ${pct}% done`}
        headers={["#", "Step", "Status", "Started", "Completed"]}
        rows={list.map((s, i) => ({
          cells: [
            String(i + 1),
            s.title,
            COLUMNS.find((c) => c.status === s.status)?.title ?? s.status,
            s.started_on ?? "",
            s.completed_on ?? "",
          ],
          fills: [
            undefined,
            undefined,
            s.status === "done"
              ? "var(--viz-predictive)"
              : s.status === "blocked"
                ? "var(--viz-raised)"
                : undefined,
          ],
        }))}
      />
      {blocking && (
        <Modal
          title={`Blocked: ${blocking.title}`}
          onClose={() => setBlocking(null)}
          footer={
            <>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setBlocking(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  void move(blocking, "blocked", reason);
                  setBlocking(null);
                }}
              >
                Mark as blocked
              </button>
            </>
          }
        >
          <label
            htmlFor="block-why"
            className="margin-bottom--xs"
            style={{ display: "block", fontWeight: 600 }}
          >
            What is blocking it?
          </label>
          <input
            id="block-why"
            data-autofocus
            className="field"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. waiting for data access"
          />
        </Modal>
      )}
    </VizFrame>
  );
}
