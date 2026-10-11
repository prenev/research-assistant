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
import { Link, useNavigate } from "react-router-dom";
import { TagChip } from "../../components/TagChip";
import { useTooltip } from "../viz/Tooltip";
import { VizFrame } from "../viz/VizFrame";
import {
  TYPE_LABEL,
  TYPE_ORDER,
  useLinkGraph,
  type GraphNode,
  type ItemType,
} from "./data";

const W = 900,
  H = 560;
type N = GraphNode & {
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
};
type L = { source: N; target: N };

const NEUTRAL = "var(--viz-neutral)";
const radius = (n: GraphNode) => 7 + Math.sqrt(n.degree) * 3.5;

/** Shape carries the kind of note; colour carries its first tag. */
function Shape({ type, r, fill }: { type: ItemType; r: number; fill: string }) {
  const common = {
    fill,
    stroke: "var(--viz-surface)",
    strokeWidth: 1.5,
  };
  switch (type) {
    case "papers":
      return (
        <rect
          x={-r * 0.85}
          y={-r * 0.85}
          width={r * 1.7}
          height={r * 1.7}
          {...common}
        />
      );
    case "proteins":
      return <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} {...common} />;
    case "log":
      return (
        <polygon
          points={`0,${-r} ${r * 0.95},${r * 0.75} ${-r * 0.95},${r * 0.75}`}
          {...common}
        />
      );
    case "decisions":
      return (
        <polygon
          points={[0, 1, 2, 3, 4, 5]
            .map(
              (i) =>
                `${Math.cos((i * Math.PI) / 3) * r},${Math.sin((i * Math.PI) / 3) * r}`,
            )
            .join(" ")}
          {...common}
        />
      );
    default:
      return <circle r={r} {...common} />;
  }
}

export function NoteGraph({ embedded }: { embedded?: boolean }) {
  const { data, isLoading } = useLinkGraph();
  const nav = useNavigate();
  const tip = useTooltip();
  const [, redraw] = useReducer((x: number) => x + 1, 0);
  const [focus, setFocus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tagSlugs, setTagSlugs] = useState<string[]>([]);
  const [hidden, setHidden] = useState<ItemType[]>([]);
  const [connectedOnly, setConnectedOnly] = useState(true);
  const [showAllOrphans, setShowAllOrphans] = useState(false);
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);
  const svgRef = useRef<SVGSVGElement>(null);
  const sim = useRef<Simulation<N, undefined> | null>(null);
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const zoomRef = useRef<ReturnType<
    typeof zoom<SVGSVGElement, unknown>
  > | null>(null);

  const allTags = useMemo(() => {
    const m = new Map<string, GraphNode["tags"][number]>();
    for (const n of data?.nodes ?? []) for (const x of n.tags) m.set(x.slug, x);
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const graph = useMemo(() => {
    if (!data) return null;
    const keep = (n: GraphNode) =>
      !hidden.includes(n.type) &&
      (!connectedOnly || n.degree > 0) &&
      tagSlugs.every((s) => n.tags.some((x) => x.slug === s));
    const nodes: N[] = data.nodes.filter(keep).map((n, i) => ({
      ...n,
      x: W / 2 + Math.cos(i) * 140,
      y: H / 2 + Math.sin(i) * 140,
    }));
    const byId = new Map(nodes.map((n) => [n.url, n]));
    const links: L[] = data.edges.flatMap((e) => {
      const s = byId.get(e.source),
        tg = byId.get(e.target);
      return s && tg ? [{ source: s, target: tg }] : [];
    });
    return { nodes, links };
  }, [data, hidden, connectedOnly, tagSlugs]);

  useEffect(() => {
    if (!graph) return;
    const s = forceSimulation<N>(graph.nodes)
      .force(
        "link",
        forceLink<N, L>(graph.links)
          .id((d) => d.url)
          .distance(80)
          .strength(0.5),
      )
      .force("charge", forceManyBody().strength(-130))
      .force("center", forceCenter(W / 2, H / 2))
      .force(
        "collide",
        forceCollide<N>().radius((d) => radius(d) + 4),
      )
      .alphaDecay(0.04);
    let frame = 0;
    s.on("end", () => {
      const xs = graph.nodes.map((n) => n.x),
        ys = graph.nodes.map((n) => n.y);
      if (!xs.length || !svgRef.current || !zoomRef.current) return;
      const x0 = Math.min(...xs) - 50,
        x1 = Math.max(...xs) + 50,
        y0 = Math.min(...ys) - 50,
        y1 = Math.max(...ys) + 50;
      const k = Math.min(W / (x1 - x0), H / (y1 - y0), 1.6);
      select(svgRef.current).call(
        zoomRef.current.transform,
        zoomIdentity
          .translate(W / 2 - (k * (x0 + x1)) / 2, H / 2 - (k * (y0 + y1)) / 2)
          .scale(k),
      );
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

  useEffect(() => {
    if (!svgRef.current) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .on("zoom", (e) => setT(e.transform));
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
      if (l.source.url === focus) ids.add(l.target.url);
      if (l.target.url === focus) ids.add(l.source.url);
    }
    return ids;
  }, [graph, focus]);
  const needle = search.trim().toLowerCase();
  const matches = (n: N) => !!needle && n.title.toLowerCase().includes(needle);
  const dim = (n: N) =>
    (connected && !connected.has(n.url)) || (!!needle && !matches(n));
  const colourOf = (n: N) => n.tags[0]?.colour ?? NEUTRAL;

  const toGraph = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    const k = W / r.width;
    return {
      x: ((e.clientX - r.left) * k - t.x) / t.k,
      y: ((e.clientY - r.top) * k - t.y) / t.k,
    };
  };
  const toggleTag = (s: string) =>
    setTagSlugs((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s]));
  const empty = !isLoading && (!data || data.nodes.length === 0);

  return (
    <VizFrame
      title="Notes graph"
      description="Every doc, paper, protein, log post and decision, joined by the [[links]] between them. Shape is the kind of note, colour is its first tag. Drag to rearrange, scroll to zoom, click a note to focus on what it connects to."
      fileName="notes-graph"
      embedded={embedded}
      empty={empty}
      emptyHint="Add notes, then link them by typing [[ and a page name."
      tools={
        <>
          <label className="filter-bar__item">
            <span>Find</span>
            <input
              className="field"
              placeholder="Note title"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Find a node"
            />
          </label>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={connectedOnly}
              onChange={(e) => setConnectedOnly(e.target.checked)}
            />
            Only linked notes
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
        </>
      }
      legend={
        <>
          <ul className="viz-legend" aria-label="Kinds of note">
            {TYPE_ORDER.map((ty) => (
              <li key={ty}>
                <button
                  type="button"
                  className={`legend-toggle${hidden.includes(ty) ? " is-off" : ""}`}
                  aria-pressed={!hidden.includes(ty)}
                  onClick={() =>
                    setHidden((h) =>
                      h.includes(ty) ? h.filter((x) => x !== ty) : [...h, ty],
                    )
                  }
                >
                  <svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden>
                    <Shape type={ty} r={7} fill="var(--viz-neutral)" />
                  </svg>{" "}
                  {TYPE_LABEL[ty]}
                </button>
              </li>
            ))}
          </ul>
          {allTags.length > 0 && (
            <ul className="tags" aria-label="Filter by tag">
              {allTags.map((tag) => (
                <li key={tag.slug}>
                  <TagChip
                    tag={tag}
                    active={tagSlugs.includes(tag.slug)}
                    onClick={() => toggleTag(tag.slug)}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      }
      table={
        data && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                </tr>
              </thead>
              <tbody>
                {data.edges.map((e, i) => (
                  <tr key={i}>
                    <td>{data.nodes.find((n) => n.url === e.source)?.title}</td>
                    <td>{data.nodes.find((n) => n.url === e.target)?.title}</td>
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
      ) : graph.nodes.length === 0 ? (
        <p className="viz-empty">
          No notes match. Clear a tag, or untick “Only linked notes”.
        </p>
      ) : (
        <>
          <svg
            ref={svgRef}
            data-export
            role="group"
            aria-label={`Graph of ${graph.nodes.length} notes. Use the table view for a keyboard-accessible list of links.`}
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
              const node = graph.nodes.find((n) => n.url === drag.current!.id);
              if (node) {
                node.fx = p.x;
                node.fy = p.y;
                drag.current.moved = true;
                sim.current?.alphaTarget(0.25).restart();
              }
            }}
            onPointerUp={() => {
              if (!drag.current) return;
              const node = graph.nodes.find((n) => n.url === drag.current!.id);
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
                  stroke="var(--viz-neutral)"
                  strokeWidth={1.5}
                  opacity={
                    connected
                      ? connected.has(l.source.url) &&
                        connected.has(l.target.url)
                        ? 0.9
                        : 0.06
                      : needle
                        ? 0.15
                        : 0.5
                  }
                />
              ))}
              {graph.nodes.map((n) => {
                const r = radius(n);
                const hit = matches(n);
                return (
                  <g
                    key={n.url}
                    data-node
                    transform={`translate(${n.x},${n.y})`}
                    opacity={dim(n) ? 0.18 : 1}
                    style={{ cursor: "pointer" }}
                    onPointerDown={(e) => {
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                      drag.current = { id: n.url, moved: false };
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (drag.current?.moved) return;
                      setFocus(focus === n.url ? null : n.url);
                    }}
                    onDoubleClick={() => nav(n.url)}
                    onMouseMove={(e) =>
                      tip.show(
                        e,
                        <>
                          <strong>{n.title}</strong>
                          <small>
                            {TYPE_LABEL[n.type]} · {n.degree} link
                            {n.degree === 1 ? "" : "s"}
                            {n.tags.length
                              ? ` · ${n.tags.map((x) => x.name).join(", ")}`
                              : ""}
                            . Double-click to open.
                          </small>
                        </>,
                      )
                    }
                    onMouseLeave={tip.hide}
                  >
                    <Shape type={n.type} r={r} fill={colourOf(n)} />
                    {hit && (
                      <circle
                        r={r + 5}
                        fill="none"
                        stroke="var(--ifm-color-primary)"
                        strokeWidth={3}
                      />
                    )}
                    {(n.degree >= 3 ||
                      hit ||
                      focus === n.url ||
                      (connected?.has(n.url) ?? false)) && (
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
                        {n.title.length > 28
                          ? n.title.slice(0, 27) + "…"
                          : n.title}
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
              <strong>{graph.nodes.find((n) => n.url === focus)?.title}</strong>
              . Double-click a note to open it.
            </p>
          )}
        </>
      )}
      {data && !embedded && (
        <div className="row margin-top--lg">
          <section className="col col--6" aria-label="Wanted pages">
            <h3>Wanted pages</h3>
            {data.wanted.length === 0 ? (
              <p className="table-sub">
                Every [[link]] points at a page that exists.
              </p>
            ) : (
              <>
                <p className="table-sub">
                  Linked to, but not written yet. Click a link inside a note to
                  create it.
                </p>
                <ul>
                  {data.wanted.map((w) => (
                    <li key={w.title}>
                      <strong>{w.title}</strong>{" "}
                      <span className="table-sub">
                        from{" "}
                        {w.from.map((f, i) => (
                          <span key={f.url}>
                            {i > 0 && ", "}
                            <Link to={f.url}>{f.title}</Link>
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          <section className="col col--6" aria-label="Unconnected notes">
            <h3>Unconnected notes</h3>
            {data.orphans.length === 0 ? (
              <p className="table-sub">Every note is connected to another.</p>
            ) : (
              <>
                <p className="table-sub">
                  Nothing links to or from these. Connect them with [[ ]] so
                  ideas do not get lost.
                </p>
                <ul>
                  {(showAllOrphans
                    ? data.orphans
                    : data.orphans.slice(0, 8)
                  ).map((o) => (
                    <li key={o.url}>
                      <span className="badge badge--secondary">
                        {TYPE_LABEL[o.type]}
                      </span>{" "}
                      <Link to={o.url}>{o.title}</Link>
                    </li>
                  ))}
                </ul>
                {data.orphans.length > 8 && (
                  <button
                    type="button"
                    className="button button--link button--sm"
                    onClick={() => setShowAllOrphans((v) => !v)}
                  >
                    {showAllOrphans
                      ? "Show fewer"
                      : `Show all ${data.orphans.length}`}
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </VizFrame>
  );
}
