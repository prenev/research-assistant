import { useMemo, useState } from "react";
import { usePapers, useProteins } from "../api/hooks";
import { Modal } from "../components/Modal";

export const VIZ_NAMES = [
  "evidence-matrix",
  "gap-map",
  "network",
  "timeline",
  "evidence-chain",
  "pipeline",
  "results",
];

/** Searchable picker for papers, proteins and visualisations. Calls onPick with the shortcode argument. */
export function EmbedPicker({
  kind,
  onPick,
  onClose,
}: {
  kind: "cite" | "paper" | "protein" | "viz";
  onPick: (arg: string) => void;
  onClose: () => void;
}) {
  const { data: papers } = usePapers();
  const { data: proteins } = useProteins();
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [params, setParams] = useState("");
  const needle = q.trim().toLowerCase();

  const options = useMemo(() => {
    if (kind === "protein")
      return (proteins ?? []).map((p) => ({
        value: p.slug,
        label: p.name,
        hint: p.category,
      }));
    if (kind === "viz")
      return VIZ_NAMES.map((v) => ({ value: v, label: v, hint: "" }));
    return (papers ?? [])
      .filter((p) => (kind === "cite" ? p.citation_number !== null : true))
      .map((p) => ({
        value: kind === "cite" ? String(p.citation_number) : p.slug,
        label: `${p.short_label}${kind === "cite" ? ` [${p.citation_number}]` : ""}`,
        hint: p.title,
      }));
  }, [kind, papers, proteins]);
  const shown = options.filter(
    (o) => !needle || `${o.label} ${o.hint}`.toLowerCase().includes(needle),
  );

  const titles = {
    cite: "Insert citation",
    paper: "Insert paper chip",
    protein: "Insert protein chip",
    viz: "Insert visualisation",
  };
  const finish = (values: string[]) => {
    if (!values.length) return;
    onPick(
      kind === "viz"
        ? [values[0], params.trim()].filter(Boolean).join(" ")
        : values.join(","),
    );
    onClose();
  };
  const toggle = (v: string) =>
    setChosen((c) =>
      kind === "cite"
        ? c.includes(v)
          ? c.filter((x) => x !== v)
          : [...c, v]
        : [v],
    );

  return (
    <Modal
      title={titles[kind]}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="button button--primary"
          disabled={!chosen.length}
          onClick={() => finish(chosen)}
        >
          Insert
        </button>
      }
    >
      <input
        data-autofocus
        className="field"
        placeholder="Search…"
        aria-label="Search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {kind === "viz" && (
        <input
          className="field margin-top--sm"
          placeholder="Optional filters, e.g. population=general_population"
          aria-label="Visualisation filters"
          value={params}
          onChange={(e) => setParams(e.target.value)}
        />
      )}
      <ul className="picker-list">
        {shown.length === 0 && (
          <li className="picker-empty">
            {kind === "cite"
              ? "No papers with a citation number yet."
              : "Nothing found."}
          </li>
        )}
        {shown.slice(0, 50).map((o) => (
          <li key={o.value}>
            <label className="picker-item">
              <input
                type={kind === "cite" ? "checkbox" : "radio"}
                name="pick"
                checked={chosen.includes(o.value)}
                onChange={() => toggle(o.value)}
                onDoubleClick={() => finish([o.value])}
              />
              <span>
                <strong>{o.label}</strong>
                {o.hint && <small> {o.hint}</small>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
