import { useEffect, useRef, useState } from "react";
import { useSaveMutation, type Obj } from "../api/crud";
import { RichEditor, type RichEditorHandle } from "../editor/LazyRichEditor";
import { useEditMode } from "../theme/EditMode";
import { useFeedback } from "./Feedback";
import { Markdown } from "./Markdown";

/**
 * A long-text field (notes, rationale…) shown as rendered text, or, in edit mode, as the same
 * borderless page editor used for docs. A small bar appears only when there is something to save.
 */
export function NoteSection({
  title,
  endpoint,
  item,
  field,
  placeholder = "Click here and start typing. Type / for headings, lists and more.",
}: {
  title: string;
  endpoint: string;
  item: Obj;
  field: string;
  placeholder?: string;
}) {
  const { editing } = useEditMode();
  const save = useSaveMutation(endpoint);
  const { toast } = useFeedback();
  const value = (item[field] as string) ?? "";
  const [draft, setDraft] = useState(value);
  const [seed, setSeed] = useState(0);
  const editorRef = useRef<RichEditorHandle>(null);
  const dirty = draft.trim() !== value.trim();

  useEffect(() => setDraft(value), [value]);

  // Don't let a refresh silently throw away unsaved writing.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!editing && !value.trim()) return null;

  // Reads the editor directly, so Save right after typing includes the last words.
  const commit = async () => {
    const current = (await editorRef.current?.getMarkdown()) ?? draft;
    if (current.trim() === value.trim()) return;
    try {
      await save.mutateAsync({ id: item.id, data: { [field]: current } });
      toast(`${title} saved`);
    } catch {
      toast(`Could not save ${title.toLowerCase()}`, "error");
    }
  };
  const discard = () => {
    setDraft(value);
    setSeed((s) => s + 1);
  };

  return (
    <section className="note-section" aria-label={title}>
      <h2>{title}</h2>
      {editing ? (
        <div
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
              e.preventDefault();
              commit();
            }
          }}
        >
          <RichEditor
            ref={editorRef}
            key={seed}
            variant="note"
            label={title}
            value={value}
            onChange={setDraft}
          />
          {!value.trim() && !dirty && (
            <p className="note-section__hint">{placeholder}</p>
          )}
          {dirty && (
            <div className="note-bar" role="status">
              <span>Unsaved changes</span>
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
                onClick={commit}
                disabled={save.isPending}
                title="Save (Ctrl+S)"
              >
                Save
              </button>
            </div>
          )}
        </div>
      ) : (
        <Markdown source={value} />
      )}
    </section>
  );
}
