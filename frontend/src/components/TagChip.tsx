import { Link } from "react-router-dom";
import { useList } from "../api/crud";

export interface TagLike {
  id?: number;
  name: string;
  slug: string;
  colour: string;
}

/** A tag as a coloured pill. The colour tints the pill; the text keeps the normal ink for contrast. */
export function TagChip({
  tag,
  count,
  to,
  active,
  onClick,
}: {
  tag: TagLike;
  count?: number;
  to?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const style = { "--tag": tag.colour || "#607d8b" } as React.CSSProperties;
  const cls = `tag-pill tag-pill--coloured${active ? " is-active" : ""}`;
  const body = (
    <>
      <span className="tag-pill__dot" aria-hidden="true" />
      {tag.name}
      {count !== undefined && <span className="tag-pill__count">{count}</span>}
    </>
  );
  if (onClick)
    return (
      <button
        type="button"
        className={cls}
        style={style}
        aria-pressed={!!active}
        onClick={onClick}
      >
        {body}
      </button>
    );
  return (
    <Link
      className={cls}
      style={style}
      to={to ?? `/tags?tags=${encodeURIComponent(tag.slug)}`}
    >
      {body}
    </Link>
  );
}

/** The tags an item carries, given their ids. */
export function ItemTags({ ids }: { ids?: number[] }) {
  const { data: tags } = useList("tags");
  const mine = (tags ?? []).filter((t) => ids?.includes(t.id));
  if (!mine.length) return null;
  return (
    <ul className="tags" aria-label="Tags">
      {mine.map((t) => (
        <li key={t.id}>
          <TagChip tag={t as never} />
        </li>
      ))}
    </ul>
  );
}
