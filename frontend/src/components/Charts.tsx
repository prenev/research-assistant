/** Small accessible horizontal bar chart. Values are also printed, so colour is never the only cue. */
export function BarChart({
  title,
  data,
}: {
  title: string;
  data: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="bar-chart">
      <figcaption>{title}</figcaption>
      {data.length === 0 ? (
        <p className="table-sub">No data yet.</p>
      ) : (
        <ul
          role="img"
          aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}
        >
          {data.map((d) => (
            <li key={d.label}>
              <span className="bar-chart__label">{d.label}</span>
              <span className="bar-chart__track" aria-hidden="true">
                <span
                  className="bar-chart__bar"
                  style={{ width: `${(100 * d.value) / max}%` }}
                />
              </span>
              <span className="bar-chart__value">{d.value}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

export function countBy<T>(
  items: T[],
  key: (t: T) => string,
  label: (k: string) => string = (k) => k,
) {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m]
    .map(([k, value]) => ({ label: label(k), value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}
