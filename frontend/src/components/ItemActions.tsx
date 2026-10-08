import { useState } from "react";
import { useDeleteMutation, type Obj } from "../api/crud";
import { useForms } from "../forms/FormHost";
import { MODELS } from "../forms/config";
import { useEditMode } from "../theme/EditMode";
import { useFeedback } from "./Feedback";
import { HistoryPanel } from "./HistoryPanel";

/** Edit / History / Delete buttons for one item. Only shown in edit mode. */
export function ItemActions({
  model,
  item,
  onDeleted,
  size = "sm",
}: {
  model: string;
  item: Obj;
  onDeleted?: () => void;
  size?: "sm" | "md";
}) {
  const { editing } = useEditMode();
  const cfg = MODELS[model];
  const { openForm } = useForms();
  const { confirm, toast } = useFeedback();
  const del = useDeleteMutation(cfg.endpoint);
  const [hist, setHist] = useState(false);
  if (!editing) return null;
  const title = cfg.titleOf(item);
  const cls = `button button--secondary button--outline button--${size}`;
  const remove = async () => {
    if (
      !(await confirm(
        `Move “${title}” to the Trash? You can restore it from the Trash page for 30 days.`,
        { confirmLabel: "Move to Trash" },
      ))
    )
      return;
    del.mutate(item.id, {
      onSuccess: () => {
        toast(`“${title}” moved to Trash`);
        onDeleted?.();
      },
      onError: () => toast("Could not delete that item", "error"),
    });
  };
  return (
    <span className="item-actions">
      <button
        type="button"
        className={cls}
        onClick={() => openForm(model, { id: item.id })}
        aria-label={`Edit ${title}`}
      >
        Edit
      </button>
      <button
        type="button"
        className={cls}
        onClick={() => setHist(true)}
        aria-label={`History of ${title}`}
      >
        History
      </button>
      <button
        type="button"
        className={`${cls} button--danger`}
        onClick={remove}
        aria-label={`Delete ${title}`}
      >
        Delete
      </button>
      {hist && (
        <HistoryPanel
          endpoint={cfg.endpoint}
          id={item.id}
          title={title}
          onClose={() => setHist(false)}
        />
      )}
    </span>
  );
}
