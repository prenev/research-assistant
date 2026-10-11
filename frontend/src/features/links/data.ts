import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";

export type ItemType = "docs" | "papers" | "proteins" | "log" | "decisions";

export const TYPE_LABEL: Record<ItemType, string> = {
  docs: "Doc",
  papers: "Paper",
  proteins: "Protein",
  log: "Log",
  decisions: "Decision",
};
export const TYPE_ORDER: ItemType[] = [
  "docs",
  "papers",
  "proteins",
  "log",
  "decisions",
];

export interface LinkItem {
  type: ItemType;
  title: string;
  url: string;
  context: string;
  aliases?: string[];
}
export interface TagRef {
  id: number;
  name: string;
  slug: string;
  colour: string;
}
export interface GraphNode extends LinkItem {
  degree: number;
  tags: TagRef[];
}
export interface Graph {
  nodes: GraphNode[];
  edges: { source: string; target: string; label: string }[];
  wanted: {
    title: string;
    from: { url: string; title: string; type: ItemType }[];
  }[];
  orphans: GraphNode[];
}
export interface Backlinks {
  incoming: (LinkItem & { snippet: string })[];
  outgoing: (LinkItem & { snippet: string })[];
  mentions: (LinkItem & { snippet: string })[];
}

export const useLinkIndex = () =>
  useQuery({
    queryKey: ["links", "index"],
    queryFn: () => api<LinkItem[]>("/links/index/"),
    staleTime: 60_000,
  });
export const useLinkGraph = () =>
  useQuery({
    queryKey: ["links", "graph"],
    queryFn: () => api<Graph>("/links/graph/"),
  });
export const useBacklinks = (url: string) =>
  useQuery({
    queryKey: ["links", "backlinks", url],
    queryFn: () =>
      api<Backlinks>(`/links/backlinks/?url=${encodeURIComponent(url)}`),
  });
export const useTagItems = (slugs: string[]) =>
  useQuery({
    queryKey: ["links", "tag-items", slugs.join(",")],
    enabled: slugs.length > 0,
    queryFn: () =>
      api<{ tags: TagRef[]; items: (LinkItem & { tags: number[] })[] }>(
        `/tag-items/?tags=${encodeURIComponent(slugs.join(","))}`,
      ),
  });

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Look a [[wikilink]] target up the way the server does: titles beat aliases. */
export function resolveLink(
  index: LinkItem[] | undefined,
  target: string,
): LinkItem | undefined {
  if (!index) return undefined;
  const want = norm(target);
  return (
    index.find((i) => norm(i.title) === want) ??
    index.find((i) => i.aliases?.some((a) => norm(a) === want))
  );
}

/** `Title|label` as written inside [[ ]]. */
export function splitWikilink(arg: string): { target: string; label: string } {
  const i = arg.indexOf("|");
  return i < 0
    ? { target: arg.trim(), label: arg.trim() }
    : {
        target: arg.slice(0, i).trim(),
        label: arg.slice(i + 1).trim() || arg.slice(0, i).trim(),
      };
}
