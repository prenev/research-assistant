import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useMe, usePapers, useProteins } from "../api/hooks";
import {
  resolveLink,
  splitWikilink,
  TYPE_LABEL,
  useLinkIndex,
} from "../features/links/data";
import { useNewPage } from "../lib/useNewPage";
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

export function ProteinChip({ slug, label }: { slug: string; label?: string }) {
  const { data } = useProteins();
  const p = data?.find((x) => x.slug === slug);
  return (
    <span className="hovercard-wrap">
      <Link className="badge badge--info chip" to={`/proteins/${slug}`}>
        {label ?? p?.name ?? slug}
      </Link>
      {p && (
        <span className="hovercard" role="tooltip">
          <strong>{p.name}</strong>
          <span className="hovercard__meta">
            {p.category.replace(/_/g, " ")} · {p.role.replace(/_/g, " ")}
          </span>
        </span>
      )}
    </span>
  );
}

function ProteinEmbed({ slug }: { slug: string }) {
  return <ProteinChip slug={slug} />;
}

const VizByName = lazy(() => import("../features/viz/VizByName"));

function VizEmbed({ arg }: { arg: string }) {
  return (
    <Suspense fallback={<div className="viz-empty">Loading chart…</div>}>
      <VizByName arg={arg} />
    </Suspense>
  );
}

/** [[Title]] or [[Title|label]]: a link to another note. A missing one offers to create it. */
function WikiLink({ arg }: { arg: string }) {
  const { data: index } = useLinkIndex();
  const { data: me } = useMe();
  const { newDocPage } = useNewPage();
  const { target, label } = splitWikilink(arg);
  const hit = resolveLink(index, target);
  if (!index) return <span className="wikilink">{label}</span>;
  if (hit)
    return (
      <span className="hovercard-wrap">
        <Link className="wikilink" to={hit.url}>
          {label}
        </Link>
        <span className="hovercard" role="tooltip">
          <strong>{hit.title}</strong>
          <span className="hovercard__meta">
            {TYPE_LABEL[hit.type]} · {hit.context}
          </span>
        </span>
      </span>
    );
  return me?.authenticated ? (
    <button
      type="button"
      className="wikilink wikilink--missing"
      title={`No page called “${target}” yet. Click to create it.`}
      onClick={() => newDocPage(undefined, target)}
    >
      {label}
    </button>
  ) : (
    <span className="wikilink wikilink--missing" title="No such page yet">
      {label}
    </span>
  );
}

export function Embed({ kind, arg }: { kind: string; arg: string }) {
  switch (kind) {
    case "link":
      return <WikiLink arg={arg} />;
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
