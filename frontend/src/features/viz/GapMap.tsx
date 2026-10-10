import { useState } from "react";
import { Link } from "react-router-dom";
import { useList } from "../../api/crud";
import { humanise } from "../../components/Badge";
import { useViz, type GapData } from "./data";
import { VizFrame } from "./VizFrame";

const POP_LABEL: Record<string, string> = {
  sporadic_ftd: "Sporadic FTD",
  genetic_ftd: "Genetic FTD",
  mutation_carriers: "Mutation carriers",
  general_population: "General population",
};
const COL_LABEL: Record<string, string> = {
  cross_sectional: "Cross-sectional",
  longitudinal: "Longitudinal / prognostic",
  prediction: "Prediction of incident disease",
};
const W = 190,
  H = 112,
  GAP = 6,
  LEFT = 150,
  TOP = 44;

export function GapMap({
  protein: initialProtein = "",
  embedded,
}: {
  protein?: string;
  embedded?: boolean;
}) {
  const [protein, setProtein] = useState(initialProtein);
  const { data: proteins } = useList("proteins");
  const { data, isLoading } = useViz<GapData>(
    "gap-map",
    protein ? `protein=${protein}` : "",
  );
  const [open, setOpen] = useState<string | null>(null);
  const total = data
    ? data.cells.reduce((n, c) => n + c.papers.length, 0) + data.unplaced.length
    : 0;
  const width = LEFT + 3 * (W + GAP);
  const height = TOP + 4 * (H + GAP);
  const sel = data?.cells.find((c) => `${c.population}:${c.column}` === open);
  const emptyCells = data?.cells.filter((c) => c.count === 0).length ?? 0;

  return (
    <VizFrame
      title="Gap map"
      description={
        protein
          ? "How many findings for the selected protein sit in each kind of study."
          : "How many papers sit in each population and kind of study. Dashed cells are gaps."
      }
      fileName="gap-map"
      embedded={embedded}
      empty={!isLoading && total === 0}
      emptyHint="Papers appear here once they have a population and a study design."
      tools={
        <label className="filter-bar__item">
          <span>Count</span>
          <select
            className="field field--inline"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          >
            <option value="">Papers</option>
            {(proteins ?? []).map((p) => (
              <option key={p.id} value={p.slug}>
                Findings for {p.name}
              </option>
            ))}
          </select>
        </label>
      }
      table={
        data && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Population</th>
                  <th>Study type</th>
                  <th>{protein ? "Findings" : "Papers"}</th>
                  <th>Papers</th>
                </tr>
              </thead>
              <tbody>
                {data.cells.map((c) => (
                  <tr key={`${c.population}${c.column}`}>
                    <td>{POP_LABEL[c.population]}</td>
                    <td>{COL_LABEL[c.column]}</td>
                    <td>{c.count}</td>
                    <td>
                      {c.papers.map((p) => p.label).join(", ") ||
                        "None (a gap)"}
                      {c.is_target ? " (this project)" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    >
      {isLoading || !data ? (
        <p>Loading…</p>
      ) : (
        <>
          <div className="viz__scroll">
            <svg
              data-export
              role="group"
              aria-label="Gap map"
              viewBox={`0 0 ${width} ${height}`}
              width={width}
              height={height}
            >
              {data.columns.map((col, ci) => (
                <text
                  key={col}
                  x={LEFT + ci * (W + GAP) + W / 2}
                  y={TOP - 14}
                  textAnchor="middle"
                  fontSize={12}
                  className="viz-strong"
                >
                  {COL_LABEL[col]}
                </text>
              ))}
              {data.rows.map((row, ri) => (
                <text
                  key={row}
                  x={LEFT - 10}
                  y={TOP + ri * (H + GAP) + H / 2 + 4}
                  textAnchor="end"
                  fontSize={12}
                  className="viz-strong"
                >
                  {POP_LABEL[row]}
                </text>
              ))}
              {data.rows.flatMap((row, ri) =>
                data.columns.map((col, ci) => {
                  const cell = data.cells.find(
                    (c) => c.population === row && c.column === col,
                  )!;
                  const x = LEFT + ci * (W + GAP);
                  const y = TOP + ri * (H + GAP);
                  const gap = cell.count === 0;
                  const key = `${row}:${col}`;
                  const shade = Math.min(cell.count, 8) / 8;
                  return (
                    <g
                      key={key}
                      role="button"
                      tabIndex={0}
                      aria-label={`${POP_LABEL[row]}, ${COL_LABEL[col]}: ${gap ? "a gap, none yet" : `${cell.count} ${protein ? "findings" : "papers"}`}${cell.is_target ? ". This project" : ""}`}
                      aria-expanded={open === key}
                      className="viz-focus"
                      style={{ cursor: "pointer" }}
                      onClick={() => setOpen(open === key ? null : key)}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") &&
                        (e.preventDefault(), setOpen(open === key ? null : key))
                      }
                    >
                      <rect
                        x={x}
                        y={y}
                        width={W}
                        height={H}
                        rx={8}
                        fill={gap ? "var(--viz-gap)" : "var(--viz-surface)"}
                        stroke={gap ? "var(--viz-gap-ink)" : "var(--viz-axis)"}
                        strokeDasharray={gap ? "5 4" : undefined}
                        strokeWidth={1.2}
                      />
                      {!gap && (
                        <rect
                          x={x}
                          y={y}
                          width={W}
                          height={H}
                          rx={8}
                          fill="var(--viz-seq-2)"
                          opacity={0.08 + shade * 0.3}
                        />
                      )}
                      <text
                        x={x + 12}
                        y={y + 34}
                        fontSize={28}
                        fontWeight={700}
                        className="viz-strong"
                        style={{ fill: gap ? "var(--viz-gap-ink)" : undefined }}
                      >
                        {cell.count}
                      </text>
                      <text
                        x={x + 12}
                        y={y + 52}
                        fontSize={11}
                        style={{ fill: gap ? "var(--viz-gap-ink)" : undefined }}
                      >
                        {gap
                          ? "Gap: nothing yet"
                          : protein
                            ? `finding${cell.count === 1 ? "" : "s"}`
                            : `paper${cell.count === 1 ? "" : "s"}`}
                      </text>
                      {cell.papers.slice(0, 3).map((p, i) => (
                        <text
                          key={p.id}
                          x={x + 12}
                          y={y + 70 + i * 13}
                          fontSize={10.5}
                          className="viz-muted"
                        >
                          {p.label}
                          {p.citation_number ? ` [${p.citation_number}]` : ""}
                        </text>
                      ))}
                      {cell.papers.length > 3 && (
                        <text
                          x={x + W - 12}
                          y={y + H - 8}
                          textAnchor="end"
                          fontSize={10.5}
                          className="viz-muted"
                        >
                          +{cell.papers.length - 3} more
                        </text>
                      )}
                      {cell.is_target && (
                        <g>
                          <rect
                            x={x}
                            y={y}
                            width={W}
                            height={H}
                            rx={8}
                            fill="none"
                            stroke="var(--viz-target)"
                            strokeWidth={3}
                          />
                          <rect
                            x={x + W - 98}
                            y={y + 10}
                            width={86}
                            height={20}
                            rx={10}
                            fill="var(--viz-target)"
                          />
                          <text
                            x={x + W - 55}
                            y={y + 24}
                            textAnchor="middle"
                            fontSize={11}
                            fontWeight={700}
                            style={{ fill: "#fff" }}
                          >
                            This project
                          </text>
                        </g>
                      )}
                    </g>
                  );
                }),
              )}
            </svg>
          </div>
          <p className="table-sub margin-top--sm">
            {emptyCells} of 12 cells are gaps.
            {data.unplaced.length > 0 &&
              ` ${data.unplaced.length} paper${data.unplaced.length === 1 ? "" : "s"} do not fit the grid (reviews, mixed or other populations).`}
          </p>
          {sel && (
            <div
              className="viz-detail"
              role="region"
              aria-label="Papers in this cell"
            >
              <strong>
                {POP_LABEL[sel.population]}, {COL_LABEL[sel.column]}
              </strong>
              {sel.papers.length === 0 ? (
                <p className="margin-bottom--none">
                  No papers yet.
                  {sel.is_target
                    ? " This is the gap this project fills: look for population-cohort or prediction studies."
                    : ""}
                </p>
              ) : (
                <ul className="margin-bottom--none">
                  {sel.papers.map((p) => (
                    <li key={p.id}>
                      <Link to={`/papers/${p.slug}`}>{p.label}</Link>: {p.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </VizFrame>
  );
}

export { humanise };
