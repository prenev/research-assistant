import { useState } from "react";
import { useList, useSaveMutation, type Obj } from "../api/crud";
import { useMe } from "../api/hooks";
import { useFeedback } from "./Feedback";
import { ItemTags, TagChip } from "./TagChip";

/**
 * Tags on one item. Anyone can read them; when logged in you can add existing tags, make new ones on
 * the spot (just type a name) and remove them, saved straight away. Tags are labels, not content, so
 * they bypass the draft/Save step used for text.
 */
export function TagPicker({
  endpoint,
  item,
}: {
  endpoint: string;
  item: { id: number; tags?: number[] };
}) {
  const { data: me } = useMe();
  const { data: allTags = [] } = useList("tags");
  const saveItem = useSaveMutation(endpoint);
  const saveTag = useSaveMutation("tags");
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const mine = item.tags ?? [];

  if (!me?.authenticated) return <ItemTags ids={mine} />;

  const setTags = async (ids: number[]) => {
    try {
      await saveItem.mutateAsync({ id: item.id, data: { tags: ids } });
    } catch {
      toast("Could not update tags", "error");
    }
  };
  const needle = q.trim().replace(/^#/, "");
  const options = allTags
    .filter((t) => !mine.includes(t.id))
    .filter((t) => t.name.toLowerCase().includes(needle.toLowerCase()));
  const exact = allTags.some(
    (t) => t.name.toLowerCase() === needle.toLowerCase(),
  );
  const canCreate = !!needle && !exact;
  const rows: { key: string; label: string; create?: boolean; tag?: Obj }[] = [
    ...options
      .slice(0, 8)
      .map((t) => ({ key: `t${t.id}`, label: t.name, tag: t })),
    ...(canCreate
      ? [{ key: "new", label: `Create “${needle}”`, create: true }]
      : []),
  ];

  const choose = async (row: (typeof rows)[number]) => {
    setQ("");
    setHi(0);
    if (row.create) {
      try {
        const t = await saveTag.mutateAsync({ data: { name: needle } });
        await setTags([...mine, t.id]);
      } catch {
        toast("Could not create the tag", "error");
      }
    } else await setTags([...mine, row.tag!.id]);
  };
  const shown = allTags.filter((t) => mine.includes(t.id));

  return (
    <div className="tag-picker">
      <ul className="tags" aria-label="Tags">
        {shown.map((t) => (
          <li key={t.id} className="tag-row">
            <TagChip tag={t as never} />
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove tag ${t.name}`}
              onClick={() => setTags(mine.filter((x) => x !== t.id))}
            >
              ×
            </button>
          </li>
        ))}
        <li>
          {open ? (
            <span className="tag-picker__box">
              <input
                data-testid="tag-input"
                className="field field--inline"
                aria-label="Add a tag"
                placeholder="Tag name…"
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setHi(0);
                }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHi((h) => Math.min(h + 1, rows.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHi((h) => Math.max(h - 1, 0));
                  } else if (e.key === "Enter" && rows[hi]) {
                    e.preventDefault();
                    void choose(rows[hi]);
                  } else if (e.key === "Escape") setOpen(false);
                }}
              />
              {rows.length > 0 && (
                <ul className="tag-picker__list" role="listbox">
                  {rows.map((r, i) => (
                    <li
                      key={r.key}
                      role="option"
                      aria-selected={i === hi}
                      className={i === hi ? "is-active" : ""}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        void choose(r);
                      }}
                    >
                      {r.tag && (
                        <span
                          className="tag-pill__dot"
                          style={
                            { "--tag": r.tag.colour } as React.CSSProperties
                          }
                        />
                      )}
                      {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </span>
          ) : (
            <button
              type="button"
              className="button button--link button--sm"
              onClick={() => setOpen(true)}
            >
              ＋ Tag
            </button>
          )}
        </li>
      </ul>
    </div>
  );
}
