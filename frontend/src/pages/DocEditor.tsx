import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useSaveMutation } from "../api/crud";
import type { DocPage } from "../api/types";
import { useFeedback } from "../components/Feedback";
import { HistoryPanel } from "../components/HistoryPanel";
import { RichEditor } from "../editor/LazyRichEditor";

type Status = "idle" | "saving" | "saved" | "error";

function ago(t: number | null, now: number) {
  if (!t) return "";
  const s = Math.round((now - t) / 1000);
  return s < 5
    ? "just now"
    : s < 60
      ? `${s}s ago`
      : `${Math.round(s / 60)} min ago`;
}

/** In-place editor for a doc page: autosaves a draft, Save publishes, Discard reverts. */
export function DocEditor({
  page,
  onDone,
}: {
  page: DocPage;
  onDone: () => void;
}) {
  const hasDraft = !!page.draft_body && page.draft_body !== page.body;
  const [useDraft, setUseDraft] = useState(true);
  const [seed, setSeed] = useState(0);
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(hasDraft ? page.draft_body! : page.body);
  const [status, setStatus] = useState<Status>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [hist, setHist] = useState(false);
  const save = useSaveMutation("doc-pages");
  const { confirm, toast } = useFeedback();
  const first = useRef(true);
  const dirty = body !== page.body || title !== page.title;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // Autosave the draft a couple of seconds after typing stops. Never touches the published body.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("saving");
    const t = setTimeout(async () => {
      try {
        await api(`/doc-pages/${page.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ draft_body: body }),
        });
        setStatus("saved");
        setSavedAt(Date.now());
      } catch {
        setStatus("error");
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [body, page.id]);

  const publish = () =>
    save.mutate(
      { id: page.id, data: { title, body, draft_body: "" } },
      {
        onSuccess: () => {
          toast("Page saved");
          onDone();
        },
        onError: () => toast("Could not save the page", "error"),
      },
    );
  const discard = async () => {
    if (
      dirty &&
      !(await confirm("Discard your unsaved changes?", {
        confirmLabel: "Discard",
      }))
    )
      return;
    save.mutate(
      { id: page.id, data: { draft_body: "" } },
      { onSuccess: onDone },
    );
  };
  const useSaved = () => {
    setBody(page.body);
    setUseDraft(false);
    setSeed((s) => s + 1);
  };

  return (
    <article className="doc-editor">
      {hasDraft && useDraft && (
        <div className="alert alert--info margin-bottom--md" role="status">
          Restored your autosaved draft.{" "}
          <button
            type="button"
            className="button button--link"
            onClick={useSaved}
          >
            Use the published version instead
          </button>
        </div>
      )}
      <label htmlFor="doc-title" className="sr-only">
        Page title
      </label>
      <input
        id="doc-title"
        className="field doc-editor__title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <RichEditor
        key={seed}
        label="Page content"
        value={body}
        onChange={setBody}
      />
      <div className="doc-editor__bar" role="toolbar" aria-label="Page editing">
        <span className="doc-editor__status" role="status" aria-live="polite">
          {status === "saving" && "Saving draft…"}
          {status === "saved" && `Saved · ${ago(savedAt, now)}`}
          {status === "error" && "Draft not saved. Check your connection."}
          {status === "idle" && (dirty ? "Unsaved changes" : "No changes")}
        </span>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setHist(true)}
        >
          History
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={discard}
        >
          Discard
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={publish}
          disabled={save.isPending}
        >
          Save
        </button>
      </div>
      {hist && (
        <HistoryPanel
          endpoint="doc-pages"
          id={page.id}
          title={page.title}
          onClose={() => setHist(false)}
          onRestored={onDone}
        />
      )}
    </article>
  );
}
