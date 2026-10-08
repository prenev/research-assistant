import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from "@blocknote/core";
import {
  createReactBlockSpec,
  createReactInlineContentSpec,
} from "@blocknote/react";

export const ADMONITION_KINDS = [
  "note",
  "tip",
  "info",
  "warning",
  "danger",
] as const;
export const EMBED_KINDS = ["cite", "paper", "protein", "viz"] as const;

export const AdmonitionBlock = createReactBlockSpec(
  {
    type: "admonition",
    propSchema: {
      kind: { default: "note", values: [...ADMONITION_KINDS] },
      title: { default: "" },
    },
    content: "inline",
  },
  {
    render: ({ block, editor, contentRef }) => (
      <div className={`admonition alert alert--${altClass(block.props.kind)}`}>
        <div className="admonition__heading" contentEditable={false}>
          <select
            aria-label="Admonition type"
            value={block.props.kind}
            onChange={(e) =>
              editor.updateBlock(block, {
                props: { kind: e.target.value as never },
              })
            }
          >
            {ADMONITION_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <input
            aria-label="Admonition title"
            placeholder={block.props.kind.toUpperCase()}
            value={block.props.title}
            onChange={(e) =>
              editor.updateBlock(block, { props: { title: e.target.value } })
            }
          />
        </div>
        <div className="admonition__content" ref={contentRef} />
      </div>
    ),
  },
);

function altClass(kind: string) {
  return (
    {
      note: "secondary",
      tip: "success",
      info: "info",
      warning: "warning",
      danger: "danger",
    }[kind] ?? "secondary"
  );
}

/** Anything the editor cannot model (details, tabs, complex admonitions) is kept as exact source. */
export const RawMarkdownBlock = createReactBlockSpec(
  { type: "rawmd", propSchema: { source: { default: "" } }, content: "none" },
  {
    render: ({ block, editor }) => (
      <div className="rawmd" contentEditable={false}>
        <div className="rawmd__label">
          Raw Markdown block (details, tabs or advanced content)
        </div>
        <textarea
          aria-label="Raw Markdown"
          value={block.props.source}
          rows={Math.max(3, block.props.source.split("\n").length)}
          onChange={(e) =>
            editor.updateBlock(block, { props: { source: e.target.value } })
          }
        />
      </div>
    ),
  },
);

export const EmbedInline = createReactInlineContentSpec(
  {
    type: "embed",
    propSchema: {
      kind: { default: "cite", values: [...EMBED_KINDS] },
      arg: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ inlineContent }) => (
      <span className="badge badge--primary chip" title="Embed">
        {inlineContent.props.kind === "cite"
          ? `[${inlineContent.props.arg}]`
          : `${inlineContent.props.kind}: ${inlineContent.props.arg}`}
      </span>
    ),
  },
);

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    admonition: AdmonitionBlock(),
    rawmd: RawMarkdownBlock(),
  },
  inlineContentSpecs: { ...defaultInlineContentSpecs, embed: EmbedInline },
});
export type NotebookEditor = typeof schema.BlockNoteEditor;
