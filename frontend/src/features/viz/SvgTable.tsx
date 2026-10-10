/**
 * An off-screen SVG rendition of a table, used only so views built from HTML (chain, board) can be
 * exported as PNG/SVG like the others. It is hidden from the screen and from assistive technology.
 */
export function SvgTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: { cells: string[]; fills?: (string | undefined)[] }[];
}) {
  const ROW = 26;
  const widths = headers.map((h, i) =>
    Math.min(
      320,
      Math.max(
        60,
        14 +
          6.6 *
            Math.max(h.length, ...rows.map((r) => (r.cells[i] ?? "").length)),
      ),
    ),
  );
  const width = widths.reduce((a, b) => a + b, 0) + 24;
  const height = 56 + (rows.length + 1) * ROW + 12;
  let x0 = 12;
  const xs = widths.map((w) => {
    const x = x0;
    x0 += w;
    return x;
  });
  const clip = (s: string, w: number) =>
    s.length * 6.6 > w - 12
      ? s.slice(0, Math.max(1, Math.floor((w - 12) / 6.6) - 1)) + "…"
      : s;
  return (
    <svg
      data-export
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ position: "absolute", left: -99999, top: 0 }}
    >
      <text x={12} y={28} fontSize={15} fontWeight={700} className="viz-strong">
        {title}
      </text>
      {headers.map((h, i) => (
        <text
          key={h + i}
          x={xs[i] + 6}
          y={56 + ROW / 2 + 4}
          fontSize={11.5}
          fontWeight={700}
          className="viz-strong"
        >
          {clip(h, widths[i])}
        </text>
      ))}
      <line
        x1={12}
        x2={width - 12}
        y1={56 + ROW}
        y2={56 + ROW}
        stroke="var(--viz-axis)"
      />
      {rows.map((r, ri) =>
        r.cells.map((c, ci) => (
          <g key={`${ri}-${ci}`}>
            {r.fills?.[ci] && (
              <rect
                x={xs[ci]}
                y={56 + (ri + 1) * ROW + 1}
                width={widths[ci] - 2}
                height={ROW - 2}
                fill={r.fills[ci]}
                opacity={0.25}
              />
            )}
            <text
              x={xs[ci] + 6}
              y={56 + (ri + 1) * ROW + ROW / 2 + 4}
              fontSize={11}
            >
              {clip(c, widths[ci])}
            </text>
          </g>
        )),
      )}
    </svg>
  );
}
