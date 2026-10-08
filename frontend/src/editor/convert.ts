import { parseBlocks } from "../lib/markdown";
import type { NotebookEditor } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const SHORTCODE = /\{\{\s*(cite|paper|protein|viz)\s*:\s*([^}]*?)\s*\}\}/g;

/** Replace `{{kind:arg}}` in text nodes with embed inline nodes. */
function withEmbeds(content: Any): Any {
  if (!Array.isArray(content)) return content;
  const out: Any[] = [];
  for (const node of content) {
    if (node.type !== "text") {
      out.push(node);
      continue;
    }
    let last = 0;
    for (const m of node.text.matchAll(SHORTCODE)) {
      if (m.index > last)
        out.push({ ...node, text: node.text.slice(last, m.index) });
      out.push({ type: "embed", props: { kind: m[1], arg: m[2] } });
      last = m.index + m[0].length;
    }
    if (last === 0) out.push(node);
    else if (last < node.text.length)
      out.push({ ...node, text: node.text.slice(last) });
  }
  return out;
}

function mapBlocks(blocks: Any[]): Any[] {
  return blocks.map((b) => ({
    ...b,
    content: withEmbeds(b.content),
    children: b.children ? mapBlocks(b.children) : b.children,
  }));
}

export async function markdownToBlocks(
  editor: NotebookEditor,
  md: string,
): Promise<Any[]> {
  const out: Any[] = [];
  for (const seg of parseBlocks(md)) {
    if (seg.type === "md") {
      if (seg.text.trim())
        out.push(...mapBlocks(await editor.tryParseMarkdownToBlocks(seg.text)));
    } else if (seg.type === "admonition") {
      const parsed = await editor.tryParseMarkdownToBlocks(seg.body);
      const simple =
        parsed.length === 1 &&
        parsed[0].type === "paragraph" &&
        !parsed[0].children?.length;
      const title = seg.title === seg.kind.toUpperCase() ? "" : seg.title;
      if (simple)
        out.push({
          type: "admonition",
          props: { kind: seg.kind, title },
          content: withEmbeds(parsed[0].content),
        });
      else out.push({ type: "rawmd", props: { source: seg.raw } });
    } else out.push({ type: "rawmd", props: { source: seg.raw } });
  }
  return out;
}

function stripEmbeds(content: Any): Any {
  if (!Array.isArray(content)) return content;
  return content.map((n: Any) =>
    n.type === "embed"
      ? { type: "text", text: `{{${n.props.kind}:${n.props.arg}}}`, styles: {} }
      : n,
  );
}
function stripBlocks(blocks: Any[]): Any[] {
  return blocks.map((b) => ({
    ...b,
    content: stripEmbeds(b.content),
    children: stripBlocks(b.children ?? []),
  }));
}

const unescapeShortcodes = (s: string) =>
  s.replace(/\{\{[^}]*\}\}/g, (m) => m.replace(/\\([_*\\])/g, "$1"));

const isEmpty = (b: Any) =>
  b.type === "paragraph" &&
  (!b.content || b.content.length === 0) &&
  !b.children?.length;

export async function blocksToMarkdown(
  editor: NotebookEditor,
  blocks: Any[],
): Promise<string> {
  const parts: string[] = [];
  let run: Any[] = [];
  const flush = async () => {
    const real = run.filter((b, i) => !(isEmpty(b) && i === run.length - 1));
    run = [];
    if (!real.length) return;
    const md = (
      await editor.blocksToMarkdownLossy(stripBlocks(real) as Any)
    ).trim();
    if (md) parts.push(unescapeShortcodes(md));
  };
  for (const b of blocks) {
    if (b.type === "admonition") {
      await flush();
      const body = unescapeShortcodes(
        (
          await editor.blocksToMarkdownLossy([
            { type: "paragraph", content: stripEmbeds(b.content) },
          ] as Any)
        ).trim(),
      );
      const title = b.props.title.trim();
      parts.push(`:::${b.props.kind}${title ? " " + title : ""}\n${body}\n:::`);
    } else if (b.type === "rawmd") {
      await flush();
      if (b.props.source.trim()) parts.push(b.props.source.trim());
    } else run.push(b);
  }
  await flush();
  return parts.join("\n\n") + (parts.length ? "\n" : "");
}
