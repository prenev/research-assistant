import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useFormMeta } from "../../api/crud";
import { useList } from "../../api/crud";
import { readParams, withParam } from "../../lib/params";

export interface VizFilterDef {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

const SHARED = [
  "population",
  "design",
  "context",
  "fluid",
  "protein_category",
  "protein_role",
] as const;

/** Filters shared by the evidence charts, kept in the URL so a view can be bookmarked or embedded. */
export function useVizFilters(names: readonly string[] = SHARED) {
  const [sp, setSp] = useSearchParams();
  const values = useMemo(() => readParams(sp, [...names]), [sp, names]);
  const query = useMemo(() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) if (v) q.set(k, v);
    return q.toString();
  }, [values]);
  return {
    values,
    query,
    set: (name: string, value: string) =>
      setSp(withParam(sp, name, value), { replace: true }),
    clear: () => setSp(new URLSearchParams(), { replace: true }),
    searchParams: sp,
    setSearchParams: setSp,
  };
}

export function useFilterDefs(): VizFilterDef[] {
  const { data: pm } = useFormMeta("papers");
  const { data: fm } = useFormMeta("findings");
  const { data: prm } = useFormMeta("proteins");
  const ch = (
    m:
      | Record<string, { choices?: { value: string; display_name: string }[] }>
      | undefined,
    n: string,
  ) =>
    (m?.[n]?.choices ?? []).map((c) => ({
      value: c.value,
      label: c.display_name,
    }));
  return [
    { name: "population", label: "Population", options: ch(pm, "population") },
    { name: "design", label: "Study design", options: ch(pm, "design") },
    { name: "context", label: "Context", options: ch(fm, "context") },
    { name: "fluid", label: "Fluid", options: ch(fm, "fluid") },
    {
      name: "protein_category",
      label: "Protein category",
      options: ch(prm, "category"),
    },
    { name: "protein_role", label: "Protein role", options: ch(prm, "role") },
  ];
}

export function FilterPanel({
  values,
  onChange,
  onClear,
  names = SHARED,
  children,
}: {
  values: Record<string, string>;
  onChange: (n: string, v: string) => void;
  onClear: () => void;
  names?: readonly string[];
  children?: React.ReactNode;
}) {
  const defs = useFilterDefs().filter((d) => names.includes(d.name as never));
  const active = Object.values(values).some(Boolean);
  return (
    <aside className="viz-filters" aria-label="Filters">
      <h2>Filters</h2>
      {defs.map((d) => (
        <label key={d.name}>
          {d.label}
          <select
            className="field field--inline"
            value={values[d.name] ?? ""}
            onChange={(e) => onChange(d.name, e.target.value)}
          >
            <option value="">All</option>
            {d.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {children}
      {active && (
        <button
          type="button"
          className="button button--link button--sm margin-top--sm"
          onClick={onClear}
        >
          Clear filters
        </button>
      )}
    </aside>
  );
}

export { useList };
