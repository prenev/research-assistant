import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { humanise } from "../../components/Badge";
import { sortBy } from "../../lib/params";
import { DirectionLegend, DirectionShape, directionLabel } from "./direction";
import { useViz, type MatrixData } from "./data";
import { useTooltip } from "./Tooltip";
import { VizFrame } from "./VizFrame";

const CELL = 26;
const LEFT = 170;
const TOP = 120;
const RIGHT = 96;

type Cell = MatrixData["cells"][number];

/** Move to the nearest existing cell in the arrow direction (the grid is sparse). */
export function neighbour(
  items: { r: number; c: number; key: string }[],
  cur: { r: number; c: number },
  key: string,
): string | null {
  const dr = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
  const dc = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  let best: { key: string; score: number } | null = null;
  for (const it of items) {
    const ar = (it.r - cur.r) * dr;
    const ac = (it.c - cur.c) * dc;
    if ((dr && ar <= 0) || (dc && ac <= 0)) continue;
    if (dc && it.r !== cur.r) continue; // left and right stay in the row
    // prefer small distance along the axis, and small drift off it
    const score = dr
      ? ar * 1000 + Math.abs(it.c - cur.c)
      : ac * 1000 + Math.abs(it.r - cur.r);
    if (!best || score < best.score) best = { key: it.key, score };
  }
  return best?.key ?? null;
}

export function EvidenceMatrix({
  query = "",
  embedded,
  includeEmpty,
}: {
  query?: string;
  embedded?: boolean;
  includeEmpty?: boolean;
}) {
  const q = [query, includeEmpty ? "include_empty=1" : ""]
    .filter(Boolean)
    .join("&");
  const { data, isLoading } = useViz<MatrixData>("evidence-matrix", q);
  const [rowSort, setRowSort] = useState<"name" | "findings">("findings");
  const [colSort, setColSort] = useState<"citation" | "year">("citation");
  const [selected, setSelected] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const tip = useTooltip();
  const svgRef = useRef<SVGSVGElement>(null);

  const model = useMemo(() => {
    if (!data) return null;
    const proteins =
      rowSort === "name"
        ? sortBy(data.proteins, (p) => p.name.toLowerCase())
        : sortBy(data.proteins, (p) => p.findings, -1);
    const papers =
      colSort === "year" ? sortBy(data.papers, (p) => p.year) : data.papers;
    const ri = new Map(proteins.map((p, i) => [p.id, i]));
    const ci = new Map(papers.map((p, i) => [p.id, i]));
    const groups = new Map<
      string,
      { r: number; c: number; key: string; cells: Cell[] }
    >();
    for (const c of data.cells) {
      const r = ri.get(c.protein),
        col = ci.get(c.paper);
      if (r === undefined || col === undefined) continue;
      const key = `${r}:${col}`;
      (
        groups.get(key) ??
        groups.set(key, { r, c: col, key, cells: [] }).get(key)!
      ).cells.push(c);
    }
    return { proteins, papers, groups: [...groups.values()] };
  }, [data, rowSort, colSort]);

  const empty =
    !isLoading && (!model || (model.groups.length === 0 && !includeEmpty));
  const width = model ? LEFT + model.papers.length * CELL + RIGHT : 0;
  const height = model ? TOP + model.proteins.length * CELL + 12 : 0;
  const active = focusKey ?? model?.groups[0]?.key ?? null;

  const onKey = (e: KeyboardEvent) => {
    if (!model || !active) return;
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const cur = model.groups.find((g) => g.key === active)!;
      const next = neighbour(model.groups, cur, e.key);
      if (next) {
        setFocusKey(next);
        requestAnimationFrame(() =>
          svgRef.current
            ?.querySelector<SVGGElement>(`[data-cell="${next}"]`)
            ?.focus(),
        );
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelected(active);
    }
  };

  const sel = model?.groups.find((g) => g.key === selected);
  const tools = (
    <>
      <label className="filter-bar__item">
        <span>Rows</span>
        <select
          className="field field--inline"
          value={rowSort}
          onChange={(e) => setRowSort(e.target.value as typeof rowSort)}
        >
          <option value="findings">Most evidence</option>
          <option value="name">A to Z</option>
        </select>
      </label>
      <label className="filter-bar__item">
        <span>Columns</span>
        <select
          className="field field--inline"
          value={colSort}
          onChange={(e) => setColSort(e.target.value as typeof colSort)}
        >
          <option value="citation">Citation number</option>
          <option value="year">Year</option>
        </select>
      </label>
    </>
  );

  return (
    <VizFrame
      title="Evidence matrix"
      description="What each paper found for each protein. Shape shows the kind of finding; the bar on the right shows how many papers agree with a protein's most common finding."
      fileName="evidence-matrix"
      empty={empty}
      emptyHint="Each paper-and-protein result you record as a finding appears here."
      embedded={embedded}
      tools={tools}
      legend={<DirectionLegend />}
      table={
        model && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Protein</th>
                  <th>Paper</th>
                  <th>Finding</th>
                  <th>Context</th>
                  <th>Effect</th>
                  <th>Subgroup</th>
                </tr>
              </thead>
              <tbody>
                {model.groups.flatMap((g) =>
                  g.cells.map((c) => (
                    <tr key={c.id}>
                      <td>{model.proteins[g.r].name}</td>
                      <td>{model.papers[g.c].label}</td>
                      <td>{directionLabel(c.direction)}</td>
                      <td>{c.context_detail || humanise(c.context)}</td>
                      <td>{c.effect}</td>
                      <td>{c.subgroup}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )
      }
    >
      {isLoading || !model ? (
        <p>Loading…</p>
      ) : (
        <>
          <div className="viz__scroll">
            <svg
              ref={svgRef}
              data-export
              role="group"
              aria-label={`Evidence matrix: ${model.proteins.length} proteins by ${model.papers.length} papers. Use the arrow keys to move between findings and Enter to open one.`}
              viewBox={`0 0 ${width} ${height}`}
              width={width}
              height={height}
              onKeyDown={onKey}
            >
              {model.proteins.map((p, r) => (
                <g key={p.id}>
                  {r % 2 === 0 && (
                    <rect
                      x={0}
                      y={TOP + r * CELL}
                      width={width}
                      height={CELL}
                      fill="var(--viz-stripe)"
                    />
                  )}
                  <Link to={`/proteins/${p.slug}`}>
                    <text
                      x={LEFT - 8}
                      y={TOP + r * CELL + CELL / 2 + 4}
                      textAnchor="end"
                      fontSize={12}
                      className="viz-strong"
                    >
                      {p.name.length > 22 ? p.name.slice(0, 21) + "…" : p.name}
                    </text>
                  </Link>
                  {p.findings > 0 && (
                    <g
                      transform={`translate(${LEFT + model.papers.length * CELL + 14},${TOP + r * CELL + CELL / 2})`}
                      onMouseMove={(e) =>
                        tip.show(
                          e,
                          <>
                            <strong>{p.name}</strong>
                            <small>
                              {p.papers} paper{p.papers === 1 ? "" : "s"},{" "}
                              {p.findings} finding{p.findings === 1 ? "" : "s"}.{" "}
                              {Math.round((p.agreement ?? 0) * 100)}% are "
                              {directionLabel(p.top_direction ?? "")}".
                            </small>
                          </>,
                        )
                      }
                      onMouseLeave={tip.hide}
                    >
                      <rect
                        x={0}
                        y={-4}
                        width={44}
                        height={8}
                        rx={4}
                        fill="var(--viz-grid)"
                      />
                      <rect
                        x={0}
                        y={-4}
                        width={44 * (p.agreement ?? 0)}
                        height={8}
                        rx={4}
                        fill="var(--viz-ink-2)"
                      />
                      <text x={52} y={4} fontSize={11}>
                        {p.papers}p
                      </text>
                    </g>
                  )}
                </g>
              ))}
              {model.papers.map((p, c) => (
                <Link key={p.id} to={`/papers/${p.slug}`}>
                  <text
                    transform={`translate(${LEFT + c * CELL + CELL / 2 + 4},${TOP - 8}) rotate(-55)`}
                    fontSize={11}
                    className="viz-strong"
                  >
                    {p.label}
                    {p.citation_number ? ` [${p.citation_number}]` : ""}
                  </text>
                </Link>
              ))}
              <text
                x={LEFT + model.papers.length * CELL + 14}
                y={TOP - 8}
                fontSize={10}
                className="viz-muted"
              >
                Agreement
              </text>
              <line
                x1={LEFT}
                x2={LEFT}
                y1={TOP}
                y2={height - 6}
                stroke="var(--viz-axis)"
              />
              {model.groups.map((g) => {
                const first = g.cells[0];
                const cx = LEFT + g.c * CELL + CELL / 2;
                const cy = TOP + g.r * CELL + CELL / 2;
                const label = `${model.proteins[g.r].name}, ${model.papers[g.c].label}: ${g.cells.map((c) => directionLabel(c.direction)).join(", ")}`;
                return (
                  <g
                    key={g.key}
                    className="mx-cell"
                    data-cell={g.key}
                    role="button"
                    tabIndex={g.key === active ? 0 : -1}
                    aria-label={label}
                    aria-pressed={selected === g.key}
                    onFocus={() => setFocusKey(g.key)}
                    onClick={() => (setFocusKey(g.key), setSelected(g.key))}
                    onMouseMove={(e) =>
                      tip.show(
                        e,
                        <>
                          <strong>{model.proteins[g.r].name}</strong> ·{" "}
                          {model.papers[g.c].label}
                          {g.cells.map((c) => (
                            <small key={c.id}>
                              {directionLabel(c.direction)}
                              {c.context_detail ? ` · ${c.context_detail}` : ""}
                              {c.effect ? ` · ${c.effect}` : ""}
                              {c.subgroup ? ` · ${c.subgroup}` : ""}
                            </small>
                          ))}
                        </>,
                      )
                    }
                    onMouseLeave={tip.hide}
                  >
                    <rect
                      className="mx-hit"
                      x={LEFT + g.c * CELL}
                      y={TOP + g.r * CELL}
                      width={CELL}
                      height={CELL}
                      fill="transparent"
                    />
                    <DirectionShape
                      direction={first.direction}
                      r={7}
                      transform={`translate(${cx},${cy})`}
                    />
                    {g.cells.length > 1 && (
                      <text
                        x={cx + 7}
                        y={cy - 6}
                        fontSize={9}
                        className="viz-strong"
                      >
                        {g.cells.length}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          {tip.node}
          {sel && (
            <div
              className="viz-detail"
              role="region"
              aria-label="Selected finding"
            >
              <strong>{model.proteins[sel.r].name}</strong> in{" "}
              <Link to={`/papers/${model.papers[sel.c].slug}`}>
                {model.papers[sel.c].label}
              </Link>
              <ul className="margin-bottom--none">
                {sel.cells.map((c) => (
                  <li key={c.id}>
                    {directionLabel(c.direction)}
                    {c.context_detail || c.context
                      ? `, ${c.context_detail || humanise(c.context)}`
                      : ""}
                    {c.effect ? `, ${c.effect}` : ""}
                    {c.subgroup ? `, ${c.subgroup}` : ""}
                  </li>
                ))}
              </ul>
              <Link to={`/proteins/${model.proteins[sel.r].slug}`}>
                Open protein
              </Link>{" "}
              ·{" "}
              <Link to={`/papers/${model.papers[sel.c].slug}`}>Open paper</Link>
            </div>
          )}
        </>
      )}
    </VizFrame>
  );
}
