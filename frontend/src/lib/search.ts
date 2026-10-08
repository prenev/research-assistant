import Fuse, { type FuseResult, type RangeTuple } from "fuse.js";

export interface SearchDoc {
  type: "docs" | "papers" | "proteins" | "log" | "decisions";
  title: string;
  url: string;
  context: string;
  text: string;
}
export type Hit = FuseResult<SearchDoc>;

export const GROUPS: { type: SearchDoc["type"]; label: string }[] = [
  { type: "docs", label: "Docs" },
  { type: "papers", label: "Papers" },
  { type: "proteins", label: "Proteins" },
  { type: "log", label: "Log" },
  { type: "decisions", label: "Decisions" },
];

export const makeFuse = (docs: SearchDoc[]) =>
  new Fuse(docs, {
    includeMatches: true,
    ignoreLocation: true,
    threshold: 0.3,
    minMatchCharLength: 2,
    keys: [
      { name: "title", weight: 3 },
      { name: "context", weight: 1 },
      { name: "text", weight: 1 },
    ],
  });

export function searchGrouped(
  fuse: Fuse<SearchDoc>,
  query: string,
  perGroup = 6,
) {
  const q = query.trim();
  if (q.length < 2) return [];
  const hits = fuse.search(q, { limit: 80 });
  return GROUPS.map((g) => ({
    ...g,
    hits: hits.filter((h) => h.item.type === g.type).slice(0, perGroup),
  })).filter((g) => g.hits.length);
}

/** Split text into parts, flagging the ranges Fuse matched. */
export function highlightParts(
  text: string,
  indices: readonly RangeTuple[] | undefined,
): { text: string; hit: boolean }[] {
  if (!indices?.length) return [{ text, hit: false }];
  const merged: [number, number][] = [];
  for (const [s, e] of [...indices].sort((a, b) => a[0] - b[0])) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const out: { text: string; hit: boolean }[] = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) out.push({ text: text.slice(pos, s), hit: false });
    out.push({ text: text.slice(s, e + 1), hit: true });
    pos = e + 1;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), hit: false });
  return out;
}

/** A short excerpt around the first match in the body text. */
export function excerpt(
  hit: Hit,
  width = 110,
): { text: string; indices: readonly RangeTuple[] } | null {
  const m = hit.matches?.find((x) => x.key === "text");
  if (!m?.indices.length) return null;
  const longest = [...m.indices].sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
  const full = hit.item.text;
  const start = Math.max(0, longest[0] - Math.floor(width / 3));
  const end = Math.min(full.length, start + width);
  const shifted = m.indices
    .filter(([s, e]) => s >= start && e < end)
    .map(([s, e]) => [s - start, e - start] as RangeTuple);
  return {
    text: (start > 0 ? "…" : "") + full.slice(start, end).replace(/\s+/g, " "),
    indices: shifted.map(
      ([s, e]) =>
        [s + (start > 0 ? 1 : 0), e + (start > 0 ? 1 : 0)] as RangeTuple,
    ),
  };
}
