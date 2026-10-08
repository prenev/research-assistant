import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post } from "../api/client";
import type { Obj } from "../api/crud";
import type { Page } from "../api/types";
import type { RelationDef } from "./config";

/** Typeahead for one or many related items, with inline "create new". */
export function RelationPicker({
  def,
  value,
  onChange,
  id,
  invalid,
}: {
  def: RelationDef;
  value: number | number[] | null;
  onChange: (v: number | number[] | null) => void;
  id: string;
  invalid?: boolean;
}) {
  const qc = useQueryClient();
  const listId = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ids = def.multiple
    ? ((value as number[]) ?? [])
    : value
      ? [value as number]
      : [];

  const { data: all } = useQuery({
    queryKey: ["picker", def.endpoint],
    queryFn: () =>
      api<Page<Obj>>(`/${def.endpoint}/?page_size=1000`).then((r) => r.results),
  });
  const byId = new Map((all ?? []).map((o) => [o.id, o]));
  const needle = text.trim().toLowerCase();
  const matches = (all ?? [])
    .filter(
      (o) =>
        !ids.includes(o.id) &&
        (!needle || def.label(o).toLowerCase().includes(needle)),
    )
    .slice(0, 8);
  const exact = (all ?? []).some((o) => def.label(o).toLowerCase() === needle);

  const choose = (oid: number) => {
    onChange(def.multiple ? [...ids, oid] : oid);
    setText("");
    setOpen(false);
  };
  const create = async () => {
    if (!def.create) return;
    setBusy(true);
    setErr("");
    try {
      const o = await post<Obj>(`/${def.endpoint}/`, def.create(text.trim()));
      await qc.invalidateQueries({ queryKey: ["picker", def.endpoint] });
      choose(o.id);
    } catch {
      setErr("Could not create it. Add it from its own form instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relation">
      {ids.length > 0 && (
        <ul className="chips" aria-label="Selected">
          {ids.map((i) => (
            <li key={i} className="badge badge--primary chip-removable">
              {byId.get(i) ? def.label(byId.get(i)!) : `#${i}`}
              <button
                type="button"
                className="clean-btn"
                aria-label={`Remove ${byId.get(i) ? def.label(byId.get(i)!) : i}`}
                onClick={() =>
                  onChange(def.multiple ? ids.filter((x) => x !== i) : null)
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {(def.multiple || ids.length === 0) && (
        <div className="relation__input">
          <input
            id={id}
            className={`field${invalid ? " field--invalid" : ""}`}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={def.create ? "Search or type to create…" : "Search…"}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (matches[0]) choose(matches[0].id);
                else if (def.create && text.trim() && !exact) create();
              }
            }}
          />
          {open &&
            (matches.length > 0 || (def.create && text.trim() && !exact)) && (
              <ul id={listId} role="listbox" className="relation__menu">
                {matches.map((o) => (
                  <li key={o.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      className="clean-btn"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(o.id)}
                    >
                      {def.label(o)}
                    </button>
                  </li>
                ))}
                {def.create && text.trim() && !exact && (
                  <li role="option" aria-selected={false}>
                    <button
                      type="button"
                      className="clean-btn relation__create"
                      disabled={busy}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={create}
                    >
                      ＋ Create “{text.trim()}”
                    </button>
                  </li>
                )}
              </ul>
            )}
        </div>
      )}
      {err && (
        <div className="field-error" role="alert">
          {err}
        </div>
      )}
    </div>
  );
}
