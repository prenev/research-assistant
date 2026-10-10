/** Export a rendered SVG as an SVG or PNG file, with theme colours resolved so it looks the same elsewhere. */

function resolveVars(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const style = getComputedStyle(document.documentElement);
  const vars = new Map<string, string>();
  for (const name of Array.from(document.styleSheets)
    .flatMap((s) => {
      try {
        return Array.from(s.cssRules);
      } catch {
        return [];
      }
    })
    .flatMap((r) => (r instanceof CSSStyleRule ? Array.from(r.style) : []))) {
    if (name.startsWith("--viz-") || name.startsWith("--ifm-font"))
      vars.set(name, style.getPropertyValue(name).trim());
  }
  let xml = new XMLSerializer().serializeToString(clone);
  for (const [name, value] of vars) xml = xml.split(`var(${name})`).join(value);
  // Text colours come from CSS rules outside the SVG, so bake them in.
  const font =
    style.getPropertyValue("--ifm-font-family-base").trim() || "sans-serif";
  const ink = vars.get("--viz-ink-2") ?? "#52514e";
  const bg = vars.get("--viz-surface") ?? "#ffffff";
  const { width, height } = svg.viewBox.baseVal.width
    ? svg.viewBox.baseVal
    : svg.getBoundingClientRect();
  xml = xml.replace(/^<svg([^>]*)>/, (_m, attrs: string) => {
    const rest = attrs.replace(/\s(width|height|style)="[^"]*"/g, "");
    return `<svg${rest} width="${width}" height="${height}" style="background:${bg};font-family:${font.replace(/"/g, "'")}">`;
  });
  if (!/^<svg[^>]*\sxmlns=/.test(xml))
    xml = xml.replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ');
  xml = xml.replace(/<text\b([^>]*)>/g, (m, attrs: string) =>
    /\sfill=/.test(attrs) ? m : `<text fill="${ink}"${attrs}>`,
  );
  return xml;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSvg(svg: SVGSVGElement, name: string) {
  download(
    new Blob([resolveVars(svg)], { type: "image/svg+xml" }),
    `${name}.svg`,
  );
}

export async function exportPng(svg: SVGSVGElement, name: string, scale = 2) {
  const xml = resolveVars(svg);
  const m = xml.match(/width="([\d.]+)" height="([\d.]+)"/);
  const w = m ? Number(m[1]) : svg.clientWidth;
  const h = m ? Number(m[2]) : svg.clientHeight;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("render failed"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  // browsers cap canvas size; keep large charts within it
  const k = Math.min(scale, 16000 / Math.max(w, h));
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(k, k);
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  await new Promise<void>((resolve) =>
    canvas.toBlob(
      (b) => (b && download(b, `${name}.png`), resolve()),
      "image/png",
    ),
  );
}
