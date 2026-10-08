// Derive Infima's six primary shades from one hex colour, as Docusaurus's palette generator does.
function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(
    (v) => v / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h =
    max === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  h *= 60;
  return [h, s * 100, l * 100];
}
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (
    "#" +
    [f(0), f(8), f(4)]
      .map((v) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
const OFFSETS = {
  "": 0,
  "-dark": -3.5,
  "-darker": -5,
  "-darkest": -10,
  "-light": 3,
  "-lighter": 5,
  "-lightest": 9,
};

export function primaryShades(hex: string, lift = 0): Record<string, string> {
  const [h, s, l] = hexToHsl(hex);
  const out: Record<string, string> = {};
  for (const [suffix, off] of Object.entries(OFFSETS)) {
    out[`--ifm-color-primary${suffix}`] = hslToHex(
      h,
      s,
      Math.max(4, Math.min(96, l + lift + off)),
    );
  }
  return out;
}

/** CSS text defining the primary palette for light and dark themes. */
export function primaryCss(hex: string): string {
  const block = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([k, v]) => `${k}:${v};`)
      .join("");
  return `:root{${block(primaryShades(hex))}}[data-theme='dark']{${block(primaryShades(hex, 14))}}`;
}
