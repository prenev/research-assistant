import { Link } from "react-router-dom";
import { usePapers, useProteins } from "../api/hooks";
import type { PaperLite } from "../api/types";

export function PaperChip({
  paper,
  label,
}: {
  paper: PaperLite;
  label?: string;
}) {
  return (
    <span className="hovercard-wrap">
      <Link className="badge badge--primary chip" to={`/papers/${paper.slug}`}>
        {label ?? paper.short_label}
      </Link>
      <span className="hovercard" role="tooltip">
        <strong>{paper.title}</strong>
        <span className="hovercard__meta">
          {[paper.journal, paper.year].filter(Boolean).join(", ")}
        </span>
        {paper.key_finding && <span>{paper.key_finding}</span>}
      </span>
    </span>
  );
}

function Cite({ arg }: { arg: string }) {
  const { data: papers } = usePapers();
  const nums = arg
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <span className="cite">
      {nums.map((n, i) => {
        const paper = papers?.find((p) => String(p.citation_number) === n);
        return (
          <span key={n}>
            {i > 0 && ", "}
            {paper ? (
              <span className="hovercard-wrap">
                <Link to={`/papers/${paper.slug}`}>[{n}]</Link>
                <span className="hovercard" role="tooltip">
                  <strong>{paper.title}</strong>
                  <span className="hovercard__meta">
                    {[paper.journal, paper.year].filter(Boolean).join(", ")}
                  </span>
                </span>
              </span>
            ) : (
              <span title="Paper not added yet">[{n}]</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function PaperEmbed({ slug }: { slug: string }) {
  const { data: papers } = usePapers();
  const paper = papers?.find((p) => p.slug === slug);
  return paper ? (
    <PaperChip paper={paper} />
  ) : (
    <span className="badge badge--secondary">{slug}</span>
  );
}

function ProteinEmbed({ slug }: { slug: string }) {
  const { data } = useProteins();
  const p = data?.find((x) => x.slug === slug);
  return (
    <Link className="badge badge--info chip" to={`/proteins/${slug}`}>
      {p?.name ?? slug}
    </Link>
  );
}

function VizEmbed({ arg }: { arg: string }) {
  const [name, ...params] = arg.split(/\s+/);
  return (
    <div className="viz-placeholder" role="note">
      <strong>{name}</strong>
      {params.length > 0 && <code>{params.join(" ")}</code>}
      <span>Visualisations arrive in Phase 5.</span>
    </div>
  );
}

export function Embed({ kind, arg }: { kind: string; arg: string }) {
  switch (kind) {
    case "cite":
      return <Cite arg={arg} />;
    case "paper":
      return <PaperEmbed slug={arg} />;
    case "protein":
      return <ProteinEmbed slug={arg} />;
    case "viz":
      return <VizEmbed arg={arg} />;
    default:
      return null;
  }
}
