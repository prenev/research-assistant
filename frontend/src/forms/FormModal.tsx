import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, post } from "../api/client";
import {
  useFormMeta,
  useOne,
  useSaveMutation,
  type FieldMeta,
  type Obj,
} from "../api/crud";
import { useSettings } from "../api/hooks";
import { Modal } from "../components/Modal";
import { useFeedback } from "../components/Feedback";
import { RichEditor } from "../editor/LazyRichEditor";
import { MODELS, type FieldDef, type Kind } from "./config";
import { RelationPicker } from "./RelationPicker";

type Values = Record<string, unknown>;
const humanise = (n: string) =>
  n.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function inferKind(def: FieldDef, meta?: FieldMeta): Kind {
  if (def.kind) return def.kind;
  if (meta?.choices) return "select";
  switch (meta?.type) {
    case "boolean":
      return "bool";
    case "date":
      return "date";
    case "integer":
      return "number";
    case "decimal":
      return "decimal";
    default:
      return "text";
  }
}

function DoiLookup({ onFill }: { onFill: (f: Values) => void }) {
  const [doi, setDoi] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "warn"; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await post<{
        found: boolean;
        fields?: Values;
        detail?: string;
        manual?: boolean;
        duplicate?: { slug: string; trashed: boolean } | null;
      }>("/papers/lookup-doi/", { doi });
      if (r.found && r.fields) {
        onFill(r.fields);
        setMsg({
          kind: r.duplicate ? "warn" : "ok",
          text: r.duplicate
            ? `Filled in, but a paper with this DOI already exists${r.duplicate.trashed ? " (in Trash)" : ""}.`
            : "Filled in from Crossref. Please review before saving.",
        });
      } else
        setMsg({
          kind: "warn",
          text: `${r.detail ?? "Not found."} Enter the details manually.`,
        });
    } catch {
      setMsg({
        kind: "warn",
        text: "Lookup failed. Enter the details manually.",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="doi-lookup">
      <label htmlFor="doi-lookup">Add by DOI</label>
      <div className="doi-lookup__row">
        <input
          id="doi-lookup"
          className="field"
          placeholder="10.1000/xyz123 or https://doi.org/…"
          value={doi}
          onChange={(e) => setDoi(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), doi.trim() && go())
          }
        />
        <button
          type="button"
          className="button button--secondary"
          disabled={busy || !doi.trim()}
          onClick={go}
        >
          {busy ? "Looking up…" : "Look up"}
        </button>
      </div>
      {msg && (
        <div
          className={`alert alert--${msg.kind === "ok" ? "success" : "warning"} margin-top--sm`}
          role="status"
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}

export interface FormModalProps {
  model: string;
  id?: number;
  initial?: Values;
  onClose: () => void;
  onSaved?: (o: Obj) => void;
}

export function FormModal({
  model,
  id,
  initial,
  onClose,
  onSaved,
}: FormModalProps) {
  const cfg = MODELS[model];
  const { data: meta } = useFormMeta(cfg.endpoint);
  const { data: existing } = useOne(cfg.endpoint, id);
  const { data: settings } = useSettings();
  const save = useSaveMutation(cfg.endpoint);
  const { toast } = useFeedback();
  const [values, setValues] = useState<Values | null>(
    id ? null : { ...cfg.defaults, ...initial },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (id && existing && values === null)
      setValues({ ...existing, ...initial });
  }, [id, existing, values, initial]);

  const set = (name: string, v: unknown) =>
    setValues((cur) => ({ ...cur, [name]: v }));
  const isResult = model === "result";
  const lowEvents =
    isResult &&
    values &&
    values.n_events !== "" &&
    values.n_events != null &&
    Number(values.n_events) < (settings?.min_event_count_warning ?? 10);

  const fields = useMemo(
    () => cfg.fields.filter((f) => !meta || f.name in meta),
    [cfg, meta],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!values) return;
    const data: Values = {};
    for (const f of fields) {
      const kind = inferKind(f, meta?.[f.name]);
      let v = values[f.name];
      if (
        ["number", "decimal", "date", "relation"].includes(kind) &&
        (v === "" || v === undefined)
      )
        v = null;
      if (kind === "relation" && f.relation?.multiple && !v) v = [];
      if (v !== undefined) data[f.name] = v;
    }
    if (isResult) data.confirmed_permitted = !!values.confirmed_permitted;
    setErrors({});
    setFormError("");
    save.mutate(
      { id, data },
      {
        onSuccess: (o) => {
          toast(`${humanise(cfg.singular)} saved`);
          onSaved?.(o);
          onClose();
        },
        onError: (err) => {
          if (
            err instanceof ApiError &&
            err.body &&
            typeof err.body === "object"
          ) {
            const out: Record<string, string> = {};
            for (const [k, v] of Object.entries(
              err.body as Record<string, unknown>,
            ))
              out[k] = Array.isArray(v) ? v.join(" ") : String(v);
            setErrors(out);
            if (out.detail || out.non_field_errors)
              setFormError(out.detail ?? out.non_field_errors);
          } else setFormError("Something went wrong. Please try again.");
        },
      },
    );
  };

  const title = `${id ? "Edit" : "Add"} ${cfg.singular}`;
  if (!values || !meta)
    return (
      <Modal title={title} onClose={onClose}>
        <p>Loading…</p>
      </Modal>
    );

  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      footer={
        <>
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="model-form"
            className="button button--primary"
            disabled={save.isPending}
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      {isResult && (
        <div className="alert alert--danger margin-bottom--md" role="note">
          <strong>Data policy:</strong> only permitted aggregate results belong
          here. Never enter participant-level data.
        </div>
      )}
      {model === "paper" && (
        <DoiLookup
          onFill={(f) =>
            setValues((cur) => ({
              ...cur,
              ...Object.fromEntries(
                Object.entries(f).filter(([, v]) => v !== "" && v !== null),
              ),
            }))
          }
        />
      )}
      <form id="model-form" className="model-form" onSubmit={submit} noValidate>
        {formError && (
          <div className="alert alert--danger" role="alert">
            {formError}
          </div>
        )}
        {fields.map((f) => {
          const m = meta[f.name];
          const kind = inferKind(f, m);
          const label = f.label ?? humanise(f.name);
          const fid = `f-${f.name}`;
          const err = errors[f.name];
          const choices = f.choices ?? m?.choices;
          const common = {
            id: fid,
            "aria-invalid": !!err,
            "aria-describedby": err ? `${fid}-err` : undefined,
            className: `field${err ? " field--invalid" : ""}`,
          };
          const v = values[f.name];
          let control;
          switch (kind) {
            case "textarea":
              control = (
                <textarea
                  {...common}
                  rows={3}
                  value={(v as string) ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              );
              break;
            case "markdown":
              control = (
                <RichEditor
                  label={label}
                  value={(v as string) ?? ""}
                  onChange={(md) => set(f.name, md)}
                />
              );
              break;
            case "select":
              control = (
                <select
                  {...common}
                  value={(v as string) ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                >
                  {!m?.required && <option value="">—</option>}
                  {choices?.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.display_name}
                    </option>
                  ))}
                </select>
              );
              break;
            case "choices": {
              const cur = (v as string[]) ?? [];
              control = (
                <div
                  className="chips chips--toggle"
                  role="group"
                  aria-label={label}
                >
                  {choices?.map((c) => (
                    <label
                      key={c.value}
                      className={`badge ${cur.includes(c.value) ? "badge--primary" : "badge--secondary"} chip-toggle`}
                    >
                      <input
                        type="checkbox"
                        checked={cur.includes(c.value)}
                        onChange={() =>
                          set(
                            f.name,
                            cur.includes(c.value)
                              ? cur.filter((x) => x !== c.value)
                              : [...cur, c.value],
                          )
                        }
                      />
                      {c.display_name}
                    </label>
                  ))}
                </div>
              );
              break;
            }
            case "relation":
              control = (
                <RelationPicker
                  id={fid}
                  def={f.relation!}
                  value={v as number | number[] | null}
                  invalid={!!err}
                  onChange={(nv) => set(f.name, nv)}
                />
              );
              break;
            case "strings": {
              const cur = ((v as string[]) ?? []).join("\n");
              control = (
                <textarea
                  {...common}
                  rows={3}
                  placeholder="One per line"
                  defaultValue={cur}
                  onChange={(e) =>
                    set(
                      f.name,
                      e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              );
              break;
            }
            case "bool":
              control = (
                <label className="checkbox-line">
                  <input
                    id={fid}
                    type="checkbox"
                    checked={!!v}
                    onChange={(e) => set(f.name, e.target.checked)}
                  />{" "}
                  {f.help ?? label}
                </label>
              );
              break;
            case "date":
              control = (
                <input
                  {...common}
                  type="date"
                  value={(v as string) ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              );
              break;
            case "number":
            case "decimal":
              control = (
                <input
                  {...common}
                  type="number"
                  step={kind === "decimal" ? "any" : 1}
                  value={(v as string | number) ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              );
              break;
            default:
              control = (
                <input
                  {...common}
                  type="text"
                  maxLength={m?.max_length}
                  value={(v as string) ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              );
          }
          return (
            <div
              key={f.name}
              className={`form-row${f.wide || kind === "markdown" ? " form-row--wide" : ""}`}
            >
              {kind !== "bool" && (
                <label htmlFor={fid}>
                  {label}
                  {m?.required && <span aria-hidden="true"> *</span>}
                </label>
              )}
              {control}
              {f.help && kind !== "bool" && (
                <small className="form-help">{f.help}</small>
              )}
              {err && (
                <div id={`${fid}-err`} className="field-error" role="alert">
                  {err}
                </div>
              )}
            </div>
          );
        })}
        {lowEvents && (
          <div className="alert alert--warning form-row--wide" role="alert">
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={!!values.confirmed_permitted}
                onChange={(e) => set("confirmed_permitted", e.target.checked)}
              />
              Fewer than {settings?.min_event_count_warning ?? 10} events. I
              confirm this figure is permitted to be shown.
            </label>
            {errors.confirmed_permitted && (
              <div className="field-error">{errors.confirmed_permitted}</div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
