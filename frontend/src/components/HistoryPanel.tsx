import { useState } from "react";
import { useHistory, useRestore } from "../api/crud";
import { sideBySide } from "../lib/diff";
import { Modal } from "./Modal";
import { useFeedback } from "./Feedback";

const SKIP = new Set(["updated_at", "created_at", "deleted_at"]);
const show = (v: unknown) =>
  typeof v === "string" ? v : (JSON.stringify(v, null, 2) ?? "");

/** Version history for any editable item: list, side-by-side diff, one-click restore. */
export function HistoryPanel({
  endpoint,
  id,
  title,
  onClose,
  onRestored,
}: {
  endpoint: string;
  id: number;
  title: string;
  onClose: () => void;
  onRestored?: () => void;
}) {
  const { data, isLoading } = useHistory(endpoint, id);
  const restore = useRestore(endpoint, id);
  const { confirm, toast } = useFeedback();
  const [sel, setSel] = useState(0);
  const entry = data?.[sel];
  const label = (t: string) =>
    ({ "+": "Created", "~": "Edited", "-": "Deleted" })[t] ?? t;

  const doRestore = async () => {
    if (!entry) return;
    const when = new Date(entry.history_date).toLocaleString();
    if (
      !(await confirm(
        `Restore the version from ${when}? The current version stays in history.`,
        { confirmLabel: "Restore", danger: false },
      ))
    )
      return;
    restore.mutate(entry.history_id, {
      onSuccess: () => {
        toast("Version restored");
        onRestored?.();
        onClose();
      },
      onError: () => toast("Could not restore that version", "error"),
    });
  };

  return (
    <Modal title={`History: ${title}`} onClose={onClose} wide>
      {isLoading && <p>Loading…</p>}
      {data && (
        <div className="history">
          <ul className="history__list" aria-label="Versions">
            {data.map((h, i) => (
              <li key={h.history_id}>
                <button
                  type="button"
                  className={`clean-btn history__item${i === sel ? " history__item--active" : ""}`}
                  aria-current={i === sel}
                  onClick={() => setSel(i)}
                >
                  <strong>{label(h.history_type)}</strong>
                  <span>{new Date(h.history_date).toLocaleString()}</span>
                  <small>
                    {h.user ?? "unknown"}
                    {i === 0 ? " · current" : ""}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          <div className="history__detail">
            {entry && (
              <>
                <div className="history__actions">
                  <span>
                    {label(entry.history_type)} by {entry.user ?? "unknown"} on{" "}
                    {new Date(entry.history_date).toLocaleString()}
                  </span>
                  {sel !== 0 && (
                    <button
                      type="button"
                      className="button button--primary button--sm"
                      onClick={doRestore}
                    >
                      Restore this version
                    </button>
                  )}
                </div>
                {entry.changes.filter((c) => !SKIP.has(c.field)).length ===
                  0 && (
                  <p className="history__none">
                    {entry.history_type === "+"
                      ? "Initial version."
                      : "No content changes."}
                  </p>
                )}
                {entry.changes
                  .filter((c) => !SKIP.has(c.field))
                  .map((c) => (
                    <section
                      key={c.field}
                      className="diff"
                      aria-label={`Changes to ${c.field}`}
                    >
                      <h4>{c.field}</h4>
                      <div className="diff__cols">
                        <div className="diff__head">Before</div>
                        <div className="diff__head">After</div>
                        {sideBySide(show(c.old), show(c.new)).map((r, i) => (
                          <div className="diff__row" key={i}>
                            <pre
                              className={`diff__cell${r.left?.type === "del" ? " diff__cell--del" : ""}`}
                            >
                              {r.left?.text ?? ""}
                            </pre>
                            <pre
                              className={`diff__cell${r.right?.type === "add" ? " diff__cell--add" : ""}`}
                            >
                              {r.right?.text ?? ""}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
