import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { post } from "../api/client";
import {
  refreshAfterWrite,
  useDeleteMutation,
  useList,
  useSaveMutation,
  type Obj,
} from "../api/crud";
import { useMe } from "../api/hooks";
import { useFeedback } from "../components/Feedback";
import { Modal } from "../components/Modal";
import { PageShell } from "../components/PageShell";
import { TagChip } from "../components/TagChip";
import {
  TYPE_LABEL,
  TYPE_ORDER,
  useTagItems,
  type ItemType,
} from "../features/links/data";
import { useQueryClient } from "@tanstack/react-query";

export const TAG_SWATCHES = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#8a5cd6",
  "#d6457a",
  "#c79a1c",
  "#1f9bb5",
  "#6b8e23",
  "#c2463d",
  "#5c6bc0",
  "#8d6e63",
  "#607d8b",
];

function ColourPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Colour">
      {TAG_SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === c}
          aria-label={c}
          className={`swatch${value.toLowerCase() === c ? " is-active" : ""}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
      <input
        type="color"
        aria-label="Custom colour"
        value={value || "#607d8b"}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function TagEditor({
  tag,
  tags,
  onClose,
}: {
  tag?: Obj;
  tags: Obj[];
  onClose: () => void;
}) {
  const save = useSaveMutation("tags");
  const del = useDeleteMutation("tags");
  const qc = useQueryClient();
  const { toast, confirm } = useFeedback();
  const [name, setName] = useState(tag?.name ?? "");
  const [colour, setColour] = useState<string>(
    tag?.colour ?? TAG_SWATCHES[tags.length % TAG_SWATCHES.length],
  );
  const [description, setDescription] = useState<string>(
    tag?.description ?? "",
  );
  const [mergeInto, setMergeInto] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    try {
      await save.mutateAsync({
        id: tag?.id,
        data: { name, colour, description },
      });
      toast(tag ? "Tag saved" : "Tag created");
      onClose();
    } catch (e) {
      const body = (e as { body?: Record<string, unknown> }).body ?? {};
      setError(
        String(Object.values(body).flat().join(" ") || "Could not save"),
      );
    }
  };
  const remove = async () => {
    if (
      !(await confirm(
        `Delete the tag “${tag!.name}”? Items keep their content and lose this tag. It goes to the Trash.`,
        { confirmLabel: "Delete tag", danger: true },
      ))
    )
      return;
    await del.mutateAsync(tag!.id);
    toast("Tag deleted");
    onClose();
  };
  const merge = async () => {
    try {
      await post(`/tags/${tag!.id}/merge/`, { into: Number(mergeInto) });
      refreshAfterWrite(qc);
      toast("Tags merged");
      onClose();
    } catch {
      toast("Could not merge", "error");
    }
  };

  return (
    <Modal
      title={tag ? `Edit tag “${tag.name}”` : "New tag"}
      onClose={onClose}
      footer={
        <>
          {tag && (
            <button
              type="button"
              className="button button--danger button--outline"
              onClick={remove}
            >
              Delete
            </button>
          )}
          <button
            type="button"
            className="button button--primary"
            disabled={!name.trim()}
            onClick={submit}
          >
            Save
          </button>
        </>
      }
    >
      <div className="form-row">
        <label htmlFor="tag-name">Name</label>
        <input
          id="tag-name"
          data-autofocus
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && submit()}
        />
        {error && (
          <div className="field-error" role="alert">
            {error}
          </div>
        )}
      </div>
      <div className="form-row">
        <span className="label-like">Colour</span>
        <ColourPicker value={colour} onChange={setColour} />
        <p className="margin-top--sm">
          <TagChip
            tag={{ name: name || "Preview", slug: "x", colour }}
            onClick={() => {}}
          />
        </p>
      </div>
      <div className="form-row">
        <label htmlFor="tag-desc">What is this tag for? (optional)</label>
        <input
          id="tag-desc"
          className="field"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      {tag && tags.length > 1 && (
        <div className="form-row">
          <label htmlFor="tag-merge">Merge into another tag</label>
          <div className="merge-row">
            <select
              id="tag-merge"
              className="field"
              value={mergeInto}
              onChange={(e) => setMergeInto(e.target.value)}
            >
              <option value="">Choose a tag…</option>
              {tags
                .filter((t) => t.id !== tag.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="button button--secondary"
              disabled={!mergeInto}
              onClick={merge}
            >
              Merge
            </button>
          </div>
          <small className="form-help">
            Everything tagged “{tag.name}” gets the other tag, and “{tag.name}”
            is removed.
          </small>
        </div>
      )}
    </Modal>
  );
}

function Results({
  slugs,
  tags,
  onAdd,
}: {
  slugs: string[];
  tags: Obj[];
  onAdd: (slug: string) => void;
}) {
  const { data, isLoading } = useTagItems(slugs);
  const items = data?.items ?? [];
  const byType = TYPE_ORDER.map(
    (t) => [t, items.filter((i) => i.type === t)] as const,
  ).filter(([, v]) => v.length);
  // Tags that appear on these items besides the chosen ones: the way to keep surfing.
  const related = useMemo(() => {
    const counts = new Map<number, number>();
    for (const i of items)
      for (const t of i.tags)
        if (!data?.tags.some((x) => x.id === t))
          counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()]
      .map(([id, n]) => ({ tag: tags.find((t) => t.id === id), n }))
      .filter((r) => r.tag)
      .sort((a, b) => b.n - a.n);
  }, [items, data, tags]);

  if (isLoading) return <p>Loading…</p>;
  return (
    <section aria-label="Tagged items">
      <h2>
        {items.length} item{items.length === 1 ? "" : "s"}
        {slugs.length > 1 ? " with all of these tags" : ""}
      </h2>
      {items.length === 0 && (
        <p className="table-sub">
          Nothing carries {slugs.length > 1 ? "all of these tags" : "this tag"}{" "}
          yet. Add tags from the Edit button on any paper, protein, doc, log
          post or decision.
        </p>
      )}
      {related.length > 0 && (
        <div className="related-tags">
          <strong>Narrow down: </strong>
          <ul className="tags">
            {related.map((r) => (
              <li key={r.tag!.id}>
                <TagChip
                  tag={r.tag as never}
                  count={r.n}
                  onClick={() => onAdd(r.tag!.slug)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
      {byType.map(([type, list]) => (
        <div key={type} className="margin-top--md">
          <h3>
            {TYPE_LABEL[type as ItemType]}s{" "}
            <span className="table-sub">{list.length}</span>
          </h3>
          <ul className="tagged-list">
            {list.map((i) => (
              <li key={i.url}>
                <Link to={i.url}>{i.title}</Link>
                <span className="table-sub"> {i.context}</span>
                <span className="tagged-list__tags">
                  {i.tags
                    .map((id) => tags.find((t) => t.id === id))
                    .filter(Boolean)
                    .map((t) => (
                      <TagChip key={t!.id} tag={t as never} />
                    ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function TagsPage() {
  const { data: tags = [] } = useList("tags");
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Obj | "new" | null>(null);
  const selected = (params.get("tags") ?? "").split(",").filter(Boolean);
  const setSelected = (next: string[]) => {
    const p = new URLSearchParams(params);
    if (next.length) p.set("tags", next.join(","));
    else p.delete("tags");
    setParams(p, { replace: false });
  };
  const toggle = (slug: string) =>
    setSelected(
      selected.includes(slug)
        ? selected.filter((s) => s !== slug)
        : [...selected, slug],
    );
  const shown = tags.filter((t) =>
    t.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const sorted = [...shown].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  );
  const chosen = tags.filter((t) => selected.includes(t.slug));

  return (
    <PageShell
      title="Tags"
      actions={
        me?.authenticated && (
          <button
            type="button"
            className="button button--primary"
            onClick={() => setEditing("new")}
          >
            New tag
          </button>
        )
      }
    >
      <p>
        Tags work across everything: papers, proteins, docs, log posts and
        decisions. Pick one or more to see what they share.
      </p>
      <div className="tag-toolbar">
        <input
          className="field field--inline"
          aria-label="Find a tag"
          placeholder="Find a tag…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {selected.length > 0 && (
          <button
            type="button"
            className="button button--link"
            onClick={() => setSelected([])}
          >
            Clear selection
          </button>
        )}
      </div>
      {tags.length === 0 ? (
        <p className="table-sub">
          No tags yet. Create one with “New tag”, or type a new name in the Tags
          field of any item.
        </p>
      ) : (
        <ul className="tags tags--big" aria-label="All tags">
          {sorted.map((t) => (
            <li key={t.id} className="tag-row">
              <TagChip
                tag={t as never}
                count={t.total}
                active={selected.includes(t.slug)}
                onClick={() => toggle(t.slug)}
              />
              {me?.authenticated && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Edit tag ${t.name}`}
                  title={t.description || "Edit tag"}
                  onClick={() => setEditing(t)}
                >
                  ✎
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {chosen.length > 0 && (
        <div className="margin-top--lg">
          <p className="table-sub">
            {chosen
              .map((t) => t.description)
              .filter(Boolean)
              .join(" · ")}
          </p>
          <Results slugs={selected} tags={tags} onAdd={toggle} />
        </div>
      )}
      {editing && (
        <TagEditor
          tag={editing === "new" ? undefined : editing}
          tags={tags}
          onClose={() => setEditing(null)}
        />
      )}
    </PageShell>
  );
}
