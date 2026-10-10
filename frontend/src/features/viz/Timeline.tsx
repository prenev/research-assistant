import { scaleLinear, scaleLog } from "d3-scale";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { humanise } from "../../components/Badge";
import { useViz, type TimelineData } from "./data";
import { useTooltip } from "./Tooltip";
import { VizFrame } from "./VizFrame";

// Colour = kind of study (three validated hues + neutral); shape = population.
const DESIGN_GROUP: Record<string, string> = {
  cross_sectional: "cross",
  case_control: "cross",
  longitudinal: "long",
  progression_model: "long",
  prediction: "pred",
  population_cohort: "pred",
};
const GROUPS = [
  {
    key: "cross",
    label: "Cross-sectional / case-control",
    colour: "var(--viz-lowered)",
  },
  {
    key: "long",
    label: "Longitudinal / progression",
    colour: "var(--viz-raised)",
  },
  {
    key: "pred",
    label: "Prediction / population cohort",
    colour: "var(--viz-predictive)",
  },
  { key: "other", label: "Reviews and other", colour: "var(--viz-neutral)" },
];
const SHAPES: Record<string, { label: string; path: (r: number) => string }> = {
  sporadic_ftd: {
    label: "Sporadic FTD",
    path: (r) =>
      `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`,
  },
  genetic_ftd: {
    label: "Genetic FTD",
    path: (r) => `M${-r},${-r}h${2 * r}v${2 * r}h${-2 * r}Z`,
  },
  mutation_carriers: {
    label: "Mutation carriers",
    path: (r) => `M0,${-r * 1.1}L${r * 1.1},${r}L${-r * 1.1},${r}Z`,
  },
  general_population: {
    label: "General population",
    path: (r) => `M0,${-r * 1.2}L${r * 1.2},0L0,${r * 1.2}L${-r * 1.2},0Z`,
  },
  other: {
    label: "Other / mixed",
    path: (r) => `M${-r},${-r}L${r},${r}M${r},${-r}L${-r},${r}`,
  },
};
const shapeOf = (pop: string) => SHAPES[pop] ?? SHAPES.other;

const W = 860,
  H = 420,
  M = { l: 64, r: 20, t: 16, b: 74 };

export function Timeline({
  query = "",
  embedded,
}: {
  query?: string;
  embedded?: boolean;
}) {
  const { data, isLoading } = useViz<TimelineData>("timeline", query);
  const [bars, setBars] = useState(true);
  const nav = useNavigate();
  const tip = useTooltip();

  const model = useMemo(() => {
    if (!data || data.papers.length === 0) return null;
    const years = data.papers.map((p) => p.year!);
    const lo = Math.min(...years) - 1,
      hi = Math.max(...years) + 1;
    const x = scaleLinear()
      .domain([lo, hi])
      .range([M.l, W - M.r]);
    const sizes = data.papers
      .map((p) => p.sample_size)
      .filter((n): n is number => !!n);
    const sMin = Math.min(10, ...sizes),
      sMax = Math.max(1000, ...sizes);
    const plotBottom = H - M.b;
    const y = scaleLog()
      .domain([sMin, sMax])
      .range([plotBottom - 34, M.t + 8])
      .nice();
    const unknownY = plotBottom - 10;
    const ticks = y
      .ticks(6)
      .filter(
        (t) =>
          Number.isInteger(Math.log10(t)) ||
          [20, 50, 200, 500, 2000, 5000].includes(t),
      );
    const maxCount = Math.max(...data.per_year.map((p) => p.count));
    return { x, y, lo, hi, plotBottom, unknownY, ticks, maxCount };
  }, [data]);

  const empty = !isLoading && (!data || data.papers.length === 0);
  const xTicks = model
    ? model.x.ticks(Math.min(12, model.hi - model.lo)).filter(Number.isInteger)
    : [];

  return (
    <VizFrame
      title="Literature timeline"
      description="When each paper was published and how large it was. Colour is the kind of study, shape is the population."
      fileName="literature-timeline"
      embedded={embedded}
      empty={empty}
      emptyHint="Papers with a publication year appear here."
      tools={
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={bars}
            onChange={(e) => setBars(e.target.checked)}
          />{" "}
          Papers per year
        </label>
      }
      legend={
        <>
          <ul className="viz-legend" aria-label="Study type (colour)">
            {GROUPS.map((g) => (
              <li key={g.key}>
                <svg width="12" height="12" aria-hidden="true">
                  <rect width="12" height="12" rx="2" fill={g.colour} />
                </svg>
                {g.label}
              </li>
            ))}
          </ul>
          <ul className="viz-legend" aria-label="Population (shape)">
            {Object.entries(SHAPES).map(([k, s]) => (
              <li key={k}>
                <svg
                  width="18"
                  height="18"
                  viewBox="-9 -9 18 18"
                  aria-hidden="true"
                >
                  <path
                    d={s.path(5)}
                    fill={k === "other" ? "none" : "var(--viz-ink-2)"}
                    stroke="var(--viz-ink-2)"
                    strokeWidth={1.6}
                  />
                </svg>
                {s.label}
              </li>
            ))}
          </ul>
        </>
      }
      table={
        data && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Paper</th>
                  <th>Year</th>
                  <th>Sample size</th>
                  <th>Design</th>
                  <th>Population</th>
                </tr>
              </thead>
              <tbody>
                {data.papers.map((p) => (
                  <tr key={p.id}>
                    <td>{p.label}</td>
                    <td>{p.year}</td>
                    <td>{p.sample_size ?? "not recorded"}</td>
                    <td>{humanise(p.design)}</td>
                    <td>{humanise(p.population)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    >
      {isLoading || !data || !model ? (
        <p>Loading…</p>
      ) : (
        <>
          <div className="viz__scroll">
            <svg
              data-export
              role="group"
              aria-label="Literature timeline"
              viewBox={`0 0 ${W} ${H}`}
              width={W}
              height={H}
            >
              {model.ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={M.l}
                    x2={W - M.r}
                    y1={model.y(t)}
                    y2={model.y(t)}
                    stroke="var(--viz-grid)"
                  />
                  <text
                    x={M.l - 8}
                    y={model.y(t) + 4}
                    textAnchor="end"
                    fontSize={11}
                  >
                    {t.toLocaleString()}
                  </text>
                </g>
              ))}
              <text
                x={14}
                y={(M.t + model.plotBottom) / 2}
                fontSize={11}
                transform={`rotate(-90 14 ${(M.t + model.plotBottom) / 2})`}
                textAnchor="middle"
              >
                Sample size (log scale)
              </text>
              <line
                x1={M.l}
                x2={W - M.r}
                y1={model.plotBottom}
                y2={model.plotBottom}
                stroke="var(--viz-axis)"
              />
              {xTicks.map((t) => (
                <text
                  key={t}
                  x={model.x(t)}
                  y={model.plotBottom + (bars ? 52 : 18)}
                  textAnchor="middle"
                  fontSize={11}
                >
                  {t}
                </text>
              ))}
              {bars &&
                data.per_year.map((p) => {
                  const h = (p.count / model.maxCount) * 26;
                  return (
                    <g key={p.year}>
                      <rect
                        x={model.x(p.year) - 7}
                        y={model.plotBottom + 8 + (26 - h)}
                        width={14}
                        height={h}
                        rx={2}
                        fill="var(--viz-ink-3)"
                        opacity={0.7}
                      />
                      <text
                        x={model.x(p.year)}
                        y={model.plotBottom + 6 + (26 - h)}
                        textAnchor="middle"
                        fontSize={9}
                      >
                        {p.count}
                      </text>
                    </g>
                  );
                })}
              {data.papers.map((p) => {
                const cx = model.x(p.year!);
                const cy = p.sample_size
                  ? model.y(p.sample_size)
                  : model.unknownY - 22;
                const g = GROUPS.find(
                  (g) => g.key === (DESIGN_GROUP[p.design] ?? "other"),
                )!;
                const s = shapeOf(p.population);
                const hollow = p.population === "other";
                return (
                  <g
                    key={p.id}
                    transform={`translate(${cx},${cy})`}
                    role="link"
                    tabIndex={0}
                    aria-label={`${p.label}, ${p.year}, ${p.sample_size ? `n ${p.sample_size}` : "sample size not recorded"}, ${humanise(p.design)}, ${humanise(p.population)}`}
                    className="viz-focus"
                    style={{ cursor: "pointer" }}
                    onClick={() => nav(`/papers/${p.slug}`)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && nav(`/papers/${p.slug}`)
                    }
                    onMouseMove={(e) =>
                      tip.show(
                        e,
                        <>
                          <strong>{p.label}</strong> ({p.year})
                          <small>{p.title}</small>
                          <small>
                            {p.sample_size
                              ? `n = ${p.sample_size.toLocaleString()}`
                              : "Sample size not recorded"}{" "}
                            · {humanise(p.design)} · {humanise(p.population)}
                          </small>
                        </>,
                      )
                    }
                    onMouseLeave={tip.hide}
                  >
                    <path
                      d={s.path(7)}
                      fill={hollow ? "none" : g.colour}
                      stroke={hollow ? g.colour : "var(--viz-surface)"}
                      strokeWidth={hollow ? 2 : 1.5}
                      opacity={0.95}
                    />
                  </g>
                );
              })}
              {data.papers.some((p) => !p.sample_size) && (
                <text
                  x={M.l + 4}
                  y={model.unknownY - 4}
                  fontSize={10}
                  className="viz-muted"
                >
                  Sample size not recorded (drawn on this line)
                </text>
              )}
            </svg>
          </div>
          {tip.node}
          {data.undated.length > 0 && (
            <p className="table-sub">
              {data.undated.length} paper
              {data.undated.length === 1 ? " has" : "s have"} no year, so{" "}
              {data.undated.length === 1 ? "it is" : "they are"} not shown.
            </p>
          )}
        </>
      )}
    </VizFrame>
  );
}
