import { EvidenceChain } from "./EvidenceChain";
import { EvidenceMatrix } from "./EvidenceMatrix";
import { GapMap } from "./GapMap";
import { Network } from "./Network";
import { PipelineBoard } from "./PipelineBoard";
import { ResultsPanel } from "./ResultsPanel";
import { Timeline } from "./Timeline";

const FILTERS = [
  "population",
  "design",
  "context",
  "fluid",
  "protein_category",
  "protein_role",
  "protein",
  "direction",
];

/** Parse "evidence-matrix population=general_population" (the part after `viz:` in an embed). */
export function parseEmbed(arg: string): {
  name: string;
  params: Record<string, string>;
} {
  const [name, ...rest] = arg.trim().split(/\s+/);
  const params: Record<string, string> = {};
  for (const part of rest) {
    const i = part.indexOf("=");
    if (i > 0) params[part.slice(0, i)] = part.slice(i + 1);
  }
  return { name, params };
}

export const queryOf = (params: Record<string, string>) =>
  new URLSearchParams(
    Object.entries(params).filter(([k, v]) => FILTERS.includes(k) && v),
  ).toString();

/** Renders a visualisation inside a doc or log post, using the same filters as its page. */
export default function VizByName({ arg }: { arg: string }) {
  const { name, params } = parseEmbed(arg);
  const query = queryOf(params);
  switch (name) {
    case "evidence-matrix":
      return (
        <EvidenceMatrix
          embedded
          query={query}
          includeEmpty={params.include_empty === "1"}
        />
      );
    case "gap-map":
      return <GapMap embedded protein={params.protein} />;
    case "network":
      return <Network embedded query={query} />;
    case "timeline":
      return <Timeline embedded query={query} />;
    case "evidence-chain":
      return <EvidenceChain embedded />;
    case "pipeline":
      return <PipelineBoard embedded readOnly />;
    case "results":
      return <ResultsPanel embedded />;
    default:
      return (
        <div className="alert alert--warning" role="note">
          Unknown visualisation “{name}”. Try evidence-matrix, gap-map, network,
          timeline, evidence-chain, pipeline or results.
        </div>
      );
  }
}
