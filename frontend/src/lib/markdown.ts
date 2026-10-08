import GithubSlugger from "github-slugger";

/** Split text into code and non-code segments so embeds/admonitions are not parsed inside code. */
function splitCode(text: string): { code: boolean; text: string }[] {
  const out: { code: boolean; text: string }[] = [];
  const re = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?\n\2[ \t]*(?=\n|$)|`[^`\n]+`/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last)
      out.push({ code: false, text: text.slice(last, m.index) });
    out.push({ code: true, text: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ code: false, text: text.slice(last) });
  return out;
}

export interface Embed {
  kind: "cite" | "paper" | "protein" | "viz";
  arg: string;
}

/**
 * Replace `{{kind:arg}}` shortcodes (outside code) with links of the form `[label](#embed:kind:arg)`
 * that the renderer swaps for components.
 */
export function transformEmbeds(text: string): string {
  return splitCode(text)
    .map((seg) =>
      seg.code
        ? seg.text
        : seg.text.replace(
            /\{\{\s*(cite|paper|protein|viz)\s*:\s*([^}]*?)\s*\}\}/g,
            (_m, kind, arg) => {
              const enc = encodeURIComponent(arg);
              return `[${kind}](#embed:${kind}:${enc})`;
            },
          ),
    )
    .join("");
}

export type Block =
  | { type: "md"; text: string }
  | { type: "admonition"; kind: string; title: string; body: string }
  | { type: "details"; title: string; body: string }
  | { type: "tabs"; tabs: { label: string; body: string }[] };

const ADMONITIONS = ["note", "tip", "info", "warning", "danger", "caution"];
const FENCE = /^(```|~~~)/;

/**
 * Split markdown into plain markdown and Docusaurus-style container blocks:
 *   :::note Optional title ... :::    :::details Summary ... :::    :::tabs with `::tab Label`
 * Containers can nest when the inner one uses more colons (::::).
 */
export function parseBlocks(src: string): Block[] {
  const lines = src.split("\n");
  const blocks: Block[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) blocks.push({ type: "md", text: buf.join("\n") });
    buf = [];
  };
  let i = 0;
  let fence: string | null = null;
  while (i < lines.length) {
    const line = lines[i];
    const f = line.match(FENCE);
    if (f) fence = fence === null ? f[1] : fence === f[1] ? null : fence;
    const open =
      fence === null ? line.match(/^(:{3,})\s*([a-z]+)[ \t]*(.*)$/) : null;
    if (
      open &&
      (ADMONITIONS.includes(open[2]) ||
        open[2] === "details" ||
        open[2] === "tabs")
    ) {
      const colons = open[1].length;
      const close = new RegExp(`^:{${colons}}\\s*$`);
      let j = i + 1;
      let inFence: string | null = null;
      while (j < lines.length) {
        const g = lines[j].match(FENCE);
        if (g)
          inFence = inFence === null ? g[1] : inFence === g[1] ? null : inFence;
        if (inFence === null && close.test(lines[j])) break;
        j++;
      }
      const body = lines.slice(i + 1, j).join("\n");
      flush();
      const [, , kind, title] = open;
      if (kind === "details")
        blocks.push({ type: "details", title: title || "Details", body });
      else if (kind === "tabs")
        blocks.push({ type: "tabs", tabs: parseTabs(body) });
      else
        blocks.push({
          type: "admonition",
          kind: kind === "caution" ? "warning" : kind,
          title: title.trim() || kind.toUpperCase(),
          body,
        });
      i = j + 1;
      continue;
    }
    buf.push(line);
    i++;
  }
  flush();
  return blocks;
}

function parseTabs(body: string): { label: string; body: string }[] {
  const tabs: { label: string; body: string[] }[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^::tab\s+(.*)$/);
    if (m) tabs.push({ label: m[1].trim(), body: [] });
    else if (tabs.length) tabs[tabs.length - 1].body.push(line);
  }
  return tabs.map((t) => ({ label: t.label, body: t.body.join("\n").trim() }));
}

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/** H2/H3 headings with ids matching rehype-slug (github-slugger), ignoring code blocks. */
export function extractToc(src: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  let fence: string | null = null;
  for (const line of src.split("\n")) {
    const f = line.match(FENCE);
    if (f) fence = fence === null ? f[1] : fence === f[1] ? null : fence;
    if (fence) continue;
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const text = m[2]
      .replace(/[`*_]/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    const id = slugger.slug(text);
    if (m[1].length === 2 || m[1].length === 3)
      items.push({ id, text, level: m[1].length as 2 | 3 });
  }
  return items;
}

/** Parse ```lang title="x" {1,3-4} meta strings. */
export function parseCodeMeta(meta: string | undefined): {
  title?: string;
  highlight: Set<number>;
} {
  const highlight = new Set<number>();
  const title = meta?.match(/title=(?:"([^"]*)"|'([^']*)')/);
  const hl = meta?.match(/\{([\d,\-\s]+)\}/);
  if (hl)
    for (const part of hl[1].split(",")) {
      const [a, b] = part.trim().split("-").map(Number);
      for (let n = a; n <= (b || a); n++) highlight.add(n);
    }
  return { title: title ? (title[1] ?? title[2]) : undefined, highlight };
}
