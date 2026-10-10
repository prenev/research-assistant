import { scaleLinear } from "d3-scale";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useList, type Obj } from "../../api/crud";
import { humanise } from "../../components/Badge";
import { useTooltip } from "./Tooltip";
import { VizFrame } from "./VizFrame";

const MODEL_COLOUR: Record<string, string> = {
  M1: "var(--viz-lowered)",
  M2: "var(--viz-raised)",
  M3: "var(--viz-predictive)",
  other: "var(--viz-neutral)",
};
const MODEL_SHAPE: Record<string, string> = {
  M1: "circle",
  M2: "square",
  M3: "diamond",
  other: "circle",
};
const REFERENCE: Record<string, { value: number; label: string } | undefined> =
  {
    delta_auc: { value: 0, label: "No change" },
    time_dependent_auc: { value: 0.5, label: "Chance" },
    c_index: { value: 0.5, label: "Chance" },
    calibration_slope: { value: 1, label: "Perfect" },
  };
type Row = Obj & { v: number; lo: number | null; hi: number | null };
const num = (v: unknown) =>
  v === null || v === undefined || v === "" ? null : Number(v);

function Marker({ model, r = 5 }: { model: string; r?: number }) {
  const s = MODEL_SHAPE[model] ?? "circle";
  const c = MODEL_COLOUR[model] ?? MODEL_COLOUR.other;
  if (s === "square")
    return (
      <rect
        x={-r}
        y={-r}
        width={2 * r}
        height={2 * r}
        fill={c}
        stroke="var(--viz-surface)"
        strokeWidth={1.5}
      />
    );
  if (s === "diamond")
    return (
      <path
        d={`M0,${-r * 1.3}L${r * 1.3},0L0,${r * 1.3}L${-r * 1.3},0Z`}
        fill={c}
        stroke="var(--viz-surface)"
        strokeWidth={1.5}
      />
    );
  return (
    <circle r={r} fill={c} stroke="var(--viz-surface)" strokeWidth={1.5} />
  );
}

export function ResultsPanel({ embedded }: { embedded?: boolean }) {
  const { data, isLoading } = useList("results");
  const tip = useTooltip();

  const model = useMemo(() => {
    const rows: Row[] = (data ?? []).map(
      (r: Obj) =>
        ({
          ...r,
          v: num(r.value)!,
          lo: num(r.ci_lower),
          hi: num(r.ci_upper),
        }) as Row,
    );
    const metrics = [...new Set(rows.map((r) => r.metric as string))];
    const primary =
      rows
        .filter((r) => r.metric === "delta_auc" && r.model_label === "M3")
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] ??
      rows
        .filter((r) => r.metric === "delta_auc")
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    return { rows, metrics, primary };
  }, [data]);

  const ROW = 30,
    LEFT = 220,
    RIGHT = 110,
    W = 820,
    HEAD = 34;
  const sections = model.metrics.map((m) => {
    const rows = model.rows
      .filter((r) => r.metric === m)
      .sort(
        (a, b) =>
          String(a.model_label).localeCompare(String(b.model_label)) ||
          String(a.date).localeCompare(String(b.date)),
      );
    const vals = rows.flatMap((r) => [r.v, r.lo ?? r.v, r.hi ?? r.v]);
    const ref = REFERENCE[m];
    if (ref) vals.push(ref.value);
    const lo = Math.min(...vals),
      hi = Math.max(...vals);
    const pad = (hi - lo || 0.1) * 0.12;
    return {
      m,
      rows,
      ref,
      x: scaleLinear()
        .domain([lo - pad, hi + pad])
        .range([LEFT, W - RIGHT])
        .nice(),
    };
  });
  const height =
    20 + sections.reduce((n, s) => n + HEAD + s.rows.length * ROW + 34, 0);
  let y0 = 14;

  const p = model.primary;
  const excludesZero =
    p && p.lo !== null && p.hi !== null ? p.lo > 0 || p.hi < 0 : null;

  return (
    <VizFrame
      title="Results"
      description="Aggregate results only, with their confidence intervals. Models are M1 (age and sex), M2 (adds NfL) and M3 (adds the inflammatory proteins)."
      fileName="results"
      embedded={embedded}
      empty={!isLoading && model.rows.length === 0}
      emptyHint="Nothing entered yet. Results come later, once the analysis has been run."
      legend={
        <ul className="viz-legend" aria-label="Models">
          {Object.entries({
            M1: "M1 age + sex",
            M2: "M2 + NfL",
            M3: "M3 + proteins",
          }).map(([k, label]) => (
            <li key={k}>
              <svg
                width="16"
                height="16"
                viewBox="-8 -8 16 16"
                aria-hidden="true"
              >
                <Marker model={k} r={5} />
              </svg>
              {label}
            </li>
          ))}
        </ul>
      }
      table={
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Result</th>
                <th>Model</th>
                <th>Metric</th>
                <th>Value</th>
                <th>95% interval</th>
                <th>Horizon</th>
                <th>Events</th>
              </tr>
            </thead>
            <tbody>
              {model.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td>{r.model_label}</td>
                  <td>{humanise(r.metric)}</td>
                  <td>{r.v}</td>
                  <td>
                    {r.lo !== null && r.hi !== null ? `${r.lo} to ${r.hi}` : ""}
                  </td>
                  <td>{r.horizon_years ?? ""}</td>
                  <td>{r.n_events ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    >
      <div className="alert alert--danger margin-bottom--md" role="note">
        <strong>Data policy:</strong> only permitted aggregate results belong
        here. Never enter participant-level data.{" "}
        <Link to="/docs/data-policy">Read the policy</Link>.
      </div>
      {p && (
        <div
          className="viz-detail margin-bottom--md"
          role="region"
          aria-label="Primary comparison"
        >
          <div className="table-sub">
            Primary comparison: M3 against M2, change in time-dependent AUC
          </div>
          <div className="kpi">
            {p.v >= 0 ? "+" : ""}
            {p.v}
          </div>
          {p.lo !== null && p.hi !== null ? (
            <p className="margin-bottom--none">
              95% interval {p.lo} to {p.hi}.{" "}
              <strong
                style={{
                  color: excludesZero
                    ? "var(--viz-predictive)"
                    : "var(--viz-raised)",
                }}
              >
                {excludesZero
                  ? "✓ The interval excludes zero."
                  : "✕ The interval includes zero."}
              </strong>{" "}
              {p.horizon_years ? `Horizon ${p.horizon_years} years. ` : ""}
              {p.n_events != null ? `${p.n_events} events.` : ""}
            </p>
          ) : (
            <p className="margin-bottom--none">
              No confidence interval entered, so it cannot be said whether it
              excludes zero.
            </p>
          )}
        </div>
      )}
      {model.rows.length > 0 && (
        <div className="viz__scroll">
          <svg
            data-export
            role="group"
            aria-label="Forest plot of results"
            viewBox={`0 0 ${W} ${height}`}
            width={W}
            height={height}
          >
            {sections.map((s) => {
              const top = y0;
              y0 += HEAD + s.rows.length * ROW + 34;
              return (
                <g key={s.m} transform={`translate(0,${top})`}>
                  <text x={12} y={16} fontSize={13} className="viz-strong">
                    {humanise(s.m)}
                  </text>
                  {s.ref && (
                    <g>
                      <line
                        x1={s.x(s.ref.value)}
                        x2={s.x(s.ref.value)}
                        y1={HEAD - 8}
                        y2={HEAD + s.rows.length * ROW}
                        stroke="var(--viz-ink-3)"
                        strokeDasharray="4 3"
                      />
                      <text
                        x={s.x(s.ref.value)}
                        y={HEAD - 12}
                        textAnchor="middle"
                        fontSize={10}
                        className="viz-muted"
                      >
                        {s.ref.label} ({s.ref.value})
                      </text>
                    </g>
                  )}
                  {s.rows.map((r, i) => {
                    const cy = HEAD + i * ROW + ROW / 2;
                    return (
                      <g
                        key={r.id}
                        onMouseMove={(e) =>
                          tip.show(
                            e,
                            <>
                              <strong>{r.title}</strong>
                              <small>
                                {r.model_label} · {humanise(r.metric)} = {r.v}
                              </small>
                              {r.lo !== null && r.hi !== null && (
                                <small>
                                  95% interval {r.lo} to {r.hi}
                                </small>
                              )}
                              <small>
                                {r.horizon_years
                                  ? `${r.horizon_years} years · `
                                  : ""}
                                {r.n_events != null
                                  ? `${r.n_events} events`
                                  : ""}
                                {r.n_participants != null
                                  ? ` · n=${r.n_participants}`
                                  : ""}
                              </small>
                            </>,
                          )
                        }
                        onMouseLeave={tip.hide}
                      >
                        <text
                          x={LEFT - 10}
                          y={cy + 4}
                          textAnchor="end"
                          fontSize={11}
                        >
                          {r.model_label} ·{" "}
                          {r.title.length > 26
                            ? r.title.slice(0, 25) + "…"
                            : r.title}
                        </text>
                        {r.lo !== null && r.hi !== null && (
                          <line
                            x1={s.x(r.lo)}
                            x2={s.x(r.hi)}
                            y1={cy}
                            y2={cy}
                            stroke={
                              MODEL_COLOUR[r.model_label] ?? MODEL_COLOUR.other
                            }
                            strokeWidth={2}
                          />
                        )}
                        <g transform={`translate(${s.x(r.v)},${cy})`}>
                          <Marker model={r.model_label} />
                        </g>
                        <text x={W - RIGHT + 8} y={cy + 4} fontSize={11}>
                          {r.v}
                          {r.hi !== null && r.lo !== null
                            ? ` (${r.lo} to ${r.hi})`
                            : ""}
                        </text>
                        {(r.horizon_years || r.n_events != null) && (
                          <text
                            x={W - RIGHT + 8}
                            y={cy + 16}
                            fontSize={9}
                            className="viz-muted"
                          >
                            {r.horizon_years ? `${r.horizon_years}y` : ""}
                            {r.n_events != null ? ` · ${r.n_events} ev.` : ""}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  <line
                    x1={LEFT}
                    x2={W - RIGHT}
                    y1={HEAD + s.rows.length * ROW}
                    y2={HEAD + s.rows.length * ROW}
                    stroke="var(--viz-axis)"
                  />
                  {s.x.ticks(5).map((t) => (
                    <text
                      key={t}
                      x={s.x(t)}
                      y={HEAD + s.rows.length * ROW + 14}
                      textAnchor="middle"
                      fontSize={10}
                    >
                      {t}
                    </text>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      )}
      {tip.node}
    </VizFrame>
  );
}
