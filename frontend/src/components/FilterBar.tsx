import type { ReactNode } from "react";

export interface FilterDef {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

/** Row of labelled selects whose values live in the URL, so a filtered view can be bookmarked. */
export function FilterBar({
  filters,
  values,
  onChange,
  onClear,
  children,
}: {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  onClear: () => void;
  children?: ReactNode;
}) {
  const active = Object.values(values).some(Boolean);
  return (
    <div className="filter-bar" role="search" aria-label="Filters">
      {children}
      {filters.map((f) => (
        <label key={f.name} className="filter-bar__item">
          <span>{f.label}</span>
          <select
            className="field field--inline"
            value={values[f.name] ?? ""}
            onChange={(e) => onChange(f.name, e.target.value)}
          >
            <option value="">All</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {active && (
        <button type="button" className="button button--link" onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}
