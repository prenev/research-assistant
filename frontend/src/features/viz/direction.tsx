import type { SVGProps } from "react";

/**
 * How a finding is drawn. Identity is the SHAPE; colour only adds polarity (raised warm, lowered
 * cool, predictive aqua). Everything else is neutral, so the chart never relies on colour alone
 * and stays within three validated hues.
 */
export interface DirectionStyle {
  label: string;
  colour: string;
  filled: boolean;
  shape: "up" | "down" | "star" | "diamond" | "circle" | "half";
}

export const DIRECTIONS: Record<string, DirectionStyle> = {
  raised: {
    label: "Raised",
    colour: "var(--viz-raised)",
    filled: true,
    shape: "up",
  },
  lowered: {
    label: "Lowered",
    colour: "var(--viz-lowered)",
    filled: true,
    shape: "down",
  },
  predictive: {
    label: "Predictive",
    colour: "var(--viz-predictive)",
    filled: true,
    shape: "star",
  },
  associated: {
    label: "Associated",
    colour: "var(--viz-assoc)",
    filled: true,
    shape: "diamond",
  },
  no_difference: {
    label: "No difference",
    colour: "var(--viz-neutral)",
    filled: false,
    shape: "circle",
  },
  not_associated: {
    label: "Not associated",
    colour: "var(--viz-neutral)",
    filled: false,
    shape: "diamond",
  },
  not_predictive: {
    label: "Not predictive",
    colour: "var(--viz-neutral)",
    filled: false,
    shape: "star",
  },
  mixed: {
    label: "Mixed",
    colour: "var(--viz-neutral)",
    filled: false,
    shape: "half",
  },
};
export const DIRECTION_ORDER = Object.keys(DIRECTIONS);
export const directionLabel = (d: string) => DIRECTIONS[d]?.label ?? d;

function starPath(r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts.push(
      `${(Math.cos(a) * rad).toFixed(2)},${(Math.sin(a) * rad).toFixed(2)}`,
    );
  }
  return `M${pts.join("L")}Z`;
}

/** A mark centred on (0,0) of size r. Wrap in a translated <g>. */
export function DirectionShape({
  direction,
  r = 7,
  ...rest
}: { direction: string; r?: number } & SVGProps<SVGGElement>) {
  const d = DIRECTIONS[direction] ?? DIRECTIONS.mixed;
  const common = {
    fill: d.filled ? d.colour : "var(--viz-surface)",
    stroke: d.colour,
    strokeWidth: d.filled ? 1 : 1.6,
    strokeLinejoin: "round" as const,
  };
  return (
    <g {...rest}>
      {d.shape === "up" && (
        <path d={`M0,${-r}L${r},${r * 0.8}L${-r},${r * 0.8}Z`} {...common} />
      )}
      {d.shape === "down" && (
        <path d={`M0,${r}L${r},${-r * 0.8}L${-r},${-r * 0.8}Z`} {...common} />
      )}
      {d.shape === "star" && <path d={starPath(r * 1.15)} {...common} />}
      {d.shape === "diamond" && (
        <path d={`M0,${-r}L${r},0L0,${r}L${-r},0Z`} {...common} />
      )}
      {d.shape === "circle" && <circle r={r * 0.8} {...common} />}
      {d.shape === "half" && (
        <>
          <circle r={r * 0.8} {...common} />
          <path
            d={`M0,${-r * 0.8}A${r * 0.8},${r * 0.8} 0 0 0 0,${r * 0.8}Z`}
            fill={d.colour}
          />
        </>
      )}
    </g>
  );
}

export function DirectionLegend({ only }: { only?: string[] }) {
  const items = only ?? DIRECTION_ORDER;
  return (
    <ul className="viz-legend" aria-label="Legend">
      {items.map((k) => (
        <li key={k}>
          <svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true">
            <DirectionShape direction={k} r={6.5} />
          </svg>
          {directionLabel(k)}
        </li>
      ))}
    </ul>
  );
}
