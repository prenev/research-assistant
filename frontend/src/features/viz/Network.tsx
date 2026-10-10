import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
} from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DIRECTIONS, DirectionLegend, directionLabel } from "./direction";
import { useViz, type NetworkData } from "./data";
import { useTooltip } from "./Tooltip";
import { VizFrame } from "./VizFrame";

const W = 900,
  H = 560;
type N = NetworkData["nodes"][number] & {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
};
type L = { source: N; target: N; direction: string; count: number };

const radius = (n: NetworkData["nodes"][number]) =>
  6 + Math.sqrt(n.degree) * 3.2;
const edgeColour = (d: string) => DIRECTIONS[d]?.colour ?? "var(--viz-neutral)";
const edgeDash = (d: string) => (DIRECTIONS[d]?.filled ? undefined : "4 3");

export function Network({
  query = "",
  embedded,
}: {
  query?: string;
  embedded?: boolean;
}) {
  const { data, isLoading } = useViz<NetworkData>("network", query);
  const nav = useNavigate();
  const tip = useTooltip();
  const [, redraw] = useReducer((x: number) => x + 1, 0);
  const [focus, setFocus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);
  const svgRef = useRef<SVGSVGElement>(null);
  const sim = useRef<Simulation<N, undefined> | null>(null);
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const zoomRef = useRef<ReturnType<
    typeof zoom<SVGSVGElement, unknown>
  > | null>(null);

  const graph = useMemo(() => {
    if (!data) return null;
    const nodes: N[] = data.nodes.map((n, i) => ({
      ...n,
      x: W / 2 + Math.cos(i) * 120,
      y: H / 2 + Math.sin(i) * 120,
    }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: L[] = data.edges.flatMap((e) => {
      const s = byId.get(e.source),
        tg = byId.get(e.target);
      return s && tg
        ? [{ source: s, target: tg, direction: e.direction, count: e.count }]
        : [];
    });
    return { nodes, links };
  }, [data]);

  useEffect(() => {
    if (!graph) return;
    const s = forceSimulation<N>(graph.nodes)
      .force(
        "link",
        forceLink<N, L>(graph.links)
          .id((d) => d.id)
          .distance(70)
          .strength(0.5),
      )
      .force("charge", forceManyBody().strength(-90))
      .force("center", forceCenter(W / 2, H / 2))
      .force(
        "collide",
        forceCollide<N>().radius((d) => radius(d) + 3),
      )
      .alphaDecay(0.04);
    let frame = 0;
    // When the layout settles, fit the whole graph in view.
    s.on("end", () => {
      const xs = graph.nodes.map((n) => n.x),
        ys = graph.nodes.map((n) => n.y);
      if (!xs.length || !svgRef.current || !zoomRef.current) return;
      const x0 = Math.min(...xs) - 40,
        x1 = Math.max(...xs) + 40,
        y0 = Math.min(...ys) - 40,
        y1 = Math.max(...ys) + 40;
      const k = Math.min(W / (x1 - x0), H / (y1 - y0), 1.6);
      const tr = zoomIdentity
        .translate(W / 2 - (k * (x0 + x1)) / 2, H / 2 - (k * (y0 + y1)) / 2)
        .scale(k);
      select(svgRef.current).call(zoomRef.current.transform, tr);
    });
    s.on("tick", () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(redraw);
    });
    sim.current = s;
    return () => {
      s.stop();
      cancelAnimationFrame(frame);
    };
  }, [graph]);

  // zoom and pan
  useEffect(() => {
    if (!svgRef.current) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .on("zoom", (e) => setT(e.transform));
    // dragging a node must not also pan the canvas
    z.filter(
      (e) =>
        !(e.target as Element).closest?.("[data-node]") &&
        !e.ctrlKey &&
        e.type !== "dblclick",
    );
    zoomRef.current = z;
    select(svgRef.current).call(z);
    return () => void select(svgRef.current).on(".zoom", null);
  }, [graph]);

  const connected = useMemo(() => {
    if (!graph || !focus) return null;
    const ids = new Set([focus]);
    for (const l of graph.links) {
      if (l.source.id === focus) ids.add(l.target.id);
      if (l.target.id === focus) ids.add(l.source.id);
    }
    return ids;
  }, [graph, focus]);
  // Label only the best-connected nodes (plus anything focused or searched), so big graphs stay readable.
  const labelAt = useMemo(() => {
    if (!graph) return 3;
    const degs = graph.nodes.map((n) => n.degree).sort((a, b) => b - a);
    return Math.max(
      3,
      degs[Math.min(degs.length - 1, Math.floor(degs.length * 0.12))] ?? 3,
    );
  }, [graph]);
  const needle = search.trim().toLowerCase();
  const matches = (n: N) => !!needle && n.label.toLowerCase().includes(needle);
  const dim = (n: N) =>
    (connected && !connected.has(n.id)) || (!!needle && !matches(n));

  const toGraph = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    const k = W / r.width;
    return {
      x: ((e.clientX - r.left) * k - t.x) / t.k,
      y: ((e.clientY - r.top) * k - t.y) / t.k,
    };
  };

  const empty = !isLoading && (!data || data.nodes.length === 0);

  return (
    <VizFrame
      title="Protein and paper network"
      description="Circles are proteins, squares are papers, lines are findings. Drag to rearrange, scroll to zoom, click a node to focus on what it connects to."
      fileName="protein-paper-network"
      embedded={embedded}
      empty={empty}
      emptyHint="Proteins and papers are linked here by the findings you record."
      tools={
        <>
          <label className="filter-bar__item">
            <span>Find</span>
            <input
              className="field"
              placeholder="Protein or paper"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Find a node"
            />
          </label>
          {focus && (
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() => setFocus(null)}
            >
              Clear focus
            </button>
          )}
          <button
            type="button"
            className="button button--secondary button--sm"
            onClick={() => {
              setT(zoomIdentity);
              if (svgRef.current)
                select(svgRef.current).call(
                  zoom<SVGSVGElement, unknown>().transform,
                  zoomIdentity,
                );
            }}
          >
            Reset view
          </button>
        </>
      }
      legend={
        <>
          <ul className="viz-legend" aria-label="Nodes">
            <li>
              <svg width="16" height="16" aria-hidden="true">
                <circle cx="8" cy="8" r="6" fill="var(--viz-protein)" />
              </svg>{" "}
              Protein
            </li>
            <li>
              <svg width="16" height="16" aria-hidden="true">
                <rect
                  x="2"
                  y="2"
                  width="12"
                  height="12"
                  fill="var(--viz-paper)"
                />
              </svg>{" "}
              Paper
            </li>
            <li>Larger means more connections</li>
          </ul>
          <DirectionLegend />
        </>
      }
      table={
        data && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Protein</th>
                  <th>Paper</th>
                  <th>Finding</th>
                  <th>Findings</th>
                </tr>
              </thead>
              <tbody>
                {data.edges.map((e, i) => (
                  <tr key={i}>
                    <td>{e.source.replace("protein:", "")}</td>
                    <td>{e.target.replace("paper:", "")}</td>
                    <td>{directionLabel(e.direction)}</td>
                    <td>{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    >
      {isLoading || !graph ? (
        <p>Loading…</p>
      ) : (
        <>
          <svg
            ref={svgRef}
            data-export
            role="group"
            aria-label={`Network of ${graph.nodes.length} proteins and papers. Use the table view for a keyboard-accessible list of connections.`}
            viewBox={`0 0 ${W} ${H}`}
            style={{
              width: "100%",
              height: "auto",
              maxHeight: "70vh",
              touchAction: "none",
              cursor: "grab",
            }}
            onClick={(e) => e.target === e.currentTarget && setFocus(null)}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const p = toGraph(e);
              const node = graph.nodes.find((n) => n.id === drag.current!.id);
              if (node) {
                node.fx = p.x;
                node.fy = p.y;
                drag.current.moved = true;
                sim.current?.alphaTarget(0.25).restart();
              }
            }}
            onPointerUp={() => {
              if (!drag.current) return;
              const node = graph.nodes.find((n) => n.id === drag.current!.id);
              if (node) {
                node.fx = null;
                node.fy = null;
              }
              sim.current?.alphaTarget(0);
              drag.current = null;
            }}
          >
            <rect width={W} height={H} fill="transparent" />
            <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>
              {graph.links.map((l, i) => (
                <line
                  key={i}
                  x1={l.source.x}
                  y1={l.source.y}
                  x2={l.target.x}
                  y2={l.target.y}
                  stroke={edgeColour(l.direction)}
                  strokeWidth={
                    (l.direction === "predictive" ? 2.6 : 1.5) +
                    Math.min(l.count - 1, 2) * 0.6
                  }
                  strokeDasharray={edgeDash(l.direction)}
                  opacity={
                    connected
                      ? connected.has(l.source.id) && connected.has(l.target.id)
                        ? 0.9
                        : 0.06
                      : needle
                        ? 0.15
                        : 0.55
                  }
                />
              ))}
              {graph.nodes.map((n) => {
                const r = radius(n);
                const isP = n.type === "protein";
                const hit = matches(n);
                return (
                  <g
                    key={n.id}
                    data-node
                    transform={`translate(${n.x},${n.y})`}
                    opacity={dim(n) ? 0.18 : 1}
                    style={{ cursor: "pointer" }}
                    onPointerDown={(e) => {
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                      drag.current = { id: n.id, moved: false };
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (drag.current?.moved) return;
                      setFocus(focus === n.id ? null : n.id);
                    }}
                    onDoubleClick={() =>
                      nav(`/${isP ? "proteins" : "papers"}/${n.slug}`)
                    }
                    onMouseMove={(e) =>
                      tip.show(
                        e,
                        <>
                          <strong>{n.label}</strong>
                          <small>
                            {isP ? "Protein" : "Paper"} · {n.degree} connection
                            {n.degree === 1 ? "" : "s"}. Double-click to open.
                          </small>
                        </>,
                      )
                    }
                    onMouseLeave={tip.hide}
                  >
                    {isP ? (
                      <circle
                        r={r}
                        fill="var(--viz-protein)"
                        stroke="var(--viz-surface)"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <rect
                        x={-r * 0.85}
                        y={-r * 0.85}
                        width={r * 1.7}
                        height={r * 1.7}
                        fill="var(--viz-paper)"
                        stroke="var(--viz-surface)"
                        strokeWidth={1.5}
                      />
                    )}
                    {hit && (
                      <circle
                        r={r + 5}
                        fill="none"
                        stroke="var(--ifm-color-primary)"
                        strokeWidth={3}
                      />
                    )}
                    {(n.degree >= labelAt ||
                      hit ||
                      focus === n.id ||
                      (connected?.has(n.id) ?? false)) && (
                      <text
                        y={-r - 4}
                        textAnchor="middle"
                        fontSize={11}
                        className="viz-strong"
                        style={{
                          paintOrder: "stroke",
                          stroke: "var(--viz-surface)",
                          strokeWidth: 3,
                        }}
                      >
                        {n.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
          {tip.node}
          {focus && (
            <p className="table-sub margin-top--sm">
              Focused on{" "}
              <strong>{graph.nodes.find((n) => n.id === focus)?.label}</strong>.
              Double-click a node to open it.
            </p>
          )}
        </>
      )}
    </VizFrame>
  );
}
