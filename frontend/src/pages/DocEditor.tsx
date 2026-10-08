import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useSaveMutation } from "../api/crud";
import { useFeedback } from "../components/Feedback";
import { HistoryPanel } from "../components/HistoryPanel";
import { RichEditor, type RichEditorHandle } from "../editor/LazyRichEditor";

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

export interface Editable {
  id: number;
  title: string;
  body: string;
  draft_body: string;
}

/**
 * In-place editor for doc pages and log posts (both have title, body and an autosaved draft_body):
 * autosaves a draft, Save publishes, Discard reverts.
 */
export function DocEditor({
  page,
  onDone,
  endpoint = "doc-pages",
  focusTitle = false,
}: {
  page: Editable;
  onDone: (newSlug?: string) => void;
  endpoint?: "doc-pages" | "log-posts";
  /** Start with the cursor in the title (for a brand-new page). */
  focusTitle?: boolean;
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
  const save = useSaveMutation(endpoint);
  const { confirm, toast } = useFeedback();
  const first = useRef(true);
  const editorRef = useRef<RichEditorHandle>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [focusBody, setFocusBody] = useState(false);
  const dirty = body !== page.body || title !== page.title;

  useEffect(() => {
    if (focusTitle) {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
  }, [focusTitle]);

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
        await api(`/${endpoint}/${page.id}/`, {
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

  // Reads the editor's content directly, so a Save right after typing never misses the last words.
  // Uses the promise (not mutate callbacks): renaming a page changes its address, which unmounts
  // this editor before callbacks would run.
  const publish = async () => {
    const current = (await editorRef.current?.getMarkdown()) ?? body;
    try {
      const saved = await save.mutateAsync({
        id: page.id,
        data: { title, body: current, draft_body: "" },
      });
      toast("Page saved");
      onDone(saved?.slug as string | undefined);
    } catch {
      toast("Could not save the page", "error");
    }
  };
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
      { onSuccess: () => onDone() },
    );
  };
  const useSaved = () => {
    setBody(page.body);
    setUseDraft(false);
    setSeed((s) => s + 1);
  };

  // Ctrl/Cmd+S saves, as in most editors.
  const publishRef = useRef(publish);
  publishRef.current = publish;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        publishRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <article className="doc-editor">
      <div className="doc-editor__bar" role="toolbar" aria-label="Editing">
        <span className="doc-editor__mode">Editing</span>
        <span className="doc-editor__status" role="status" aria-live="polite">
          {status === "saving" && "Saving draft…"}
          {status === "saved" && `Saved · ${ago(savedAt, now)}`}
          {status === "error" && "Draft not saved. Check your connection."}
          {status === "idle" && (dirty ? "Unsaved changes" : "No changes")}
        </span>
        <button
          type="button"
          className="button button--link button--sm"
          onClick={() => setHist(true)}
        >
          History
        </button>
        <button
          type="button"
          className="button button--link button--sm"
          onClick={discard}
        >
          Discard
        </button>
        <button
          type="button"
          className="button button--primary button--sm"
          onClick={publish}
          disabled={save.isPending}
          title="Save (Ctrl+S)"
        >
          Save
        </button>
      </div>
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
        Title
      </label>
      <input
        id="doc-title"
        ref={titleRef}
        className="doc-editor__title"
        placeholder="Untitled"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          // Enter moves from the title into the body, like Notion.
          if (e.key === "Enter" || e.key === "ArrowDown") {
            e.preventDefault();
            // If the editor is still loading, it takes focus as soon as it is ready.
            if (editorRef.current) editorRef.current.focus();
            else setFocusBody(true);
          }
        }}
      />
      <RichEditor
        ref={editorRef}
        key={seed}
        variant="page"
        autoFocus={focusBody}
        label="Content"
        value={body}
        onChange={setBody}
      />
      {hist && (
        <HistoryPanel
          endpoint={endpoint}
          id={page.id}
          title={page.title}
          onClose={() => setHist(false)}
          onRestored={onDone}
        />
      )}
    </article>
  );
}
