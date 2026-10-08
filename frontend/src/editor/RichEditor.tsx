import { filterSuggestionItems } from "@blocknote/core/extensions";
import "@blocknote/core/fonts/inter.css";
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { api } from "../api/client";
import { useTheme } from "../theme/ThemeContext";
import { blocksToMarkdown, markdownToBlocks } from "./convert";
import { EmbedPicker } from "./EmbedPicker";
import { ADMONITION_KINDS, schema } from "./schema";

async function uploadImage(
  file: File,
): Promise<string | Record<string, unknown>> {
  const alt =
    window.prompt(
      "Describe this image for people using screen readers (alt text):",
      "",
    ) ?? "";
  const form = new FormData();
  form.append("file", file);
  const res = await api<{ url: string }>("/uploads/", {
    method: "POST",
    body: form,
    headers: {},
  });
  return { url: res.url, name: file.name, caption: alt };
}

type PickKind = "cite" | "paper" | "protein" | "viz";

export interface RichEditorHandle {
  focus: () => void;
  focusEnd: () => void;
  /** The current content as Markdown, right now (not waiting for the typing debounce). */
  getMarkdown: () => Promise<string>;
}
export interface RichEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  label?: string;
  /** "page" is a borderless canvas like a document; "inline" is a light box for use inside forms. */
  variant?: "page" | "note" | "inline";
  autoFocus?: boolean;
}

/** BlockNote editor that reads and writes Markdown (Docusaurus flavour + notebook embeds). */
export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  function RichEditor(
    {
      value,
      onChange,
      label = "Content",
      variant = "inline",
      autoFocus = false,
    },
    ref,
  ) {
    const { theme } = useTheme();
    const editor = useCreateBlockNote({ schema, uploadFile: uploadImage });
    const last = useRef<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>();
    const [picker, setPicker] = useState<PickKind | null>(null);
    const [ready, setReady] = useState(false);

    const focusEnd = () => {
      const blocks = editor.document;
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock) editor.setTextCursorPosition(lastBlock, "end");
      editor.focus();
    };
    useImperativeHandle(ref, () => ({
      focus: () => editor.focus(),
      focusEnd,
      getMarkdown: () => blocksToMarkdown(editor, editor.document),
    }));

    useEffect(() => {
      let cancelled = false;
      (async () => {
        const blocks = await markdownToBlocks(editor, value);
        if (cancelled) return;
        editor.replaceBlocks(
          editor.document,
          blocks.length ? blocks : [{ type: "paragraph" }],
        );
        // Baseline: what the editor would write back for the untouched content.
        last.current = await blocksToMarkdown(editor, editor.document);
        setReady(true);
      })();
      return () => {
        cancelled = true;
        clearTimeout(timer.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor]);

    // Focus as soon as the content is loaded (also covers focus requested before the editor was ready).
    useEffect(() => {
      if (ready && autoFocus) editor.focus();
    }, [ready, autoFocus, editor]);

    const handleChange = () => {
      if (last.current === null) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const md = await blocksToMarkdown(editor, editor.document);
        if (md !== last.current) {
          last.current = md;
          onChange(md);
        }
      }, 300);
    };

    const insertBlock = (kind: string) => {
      const cur = editor.getTextCursorPosition().block;
      editor.insertBlocks(
        [{ type: "admonition", props: { kind: kind as never } }],
        cur,
        "after",
      );
    };
    const insertEmbed = (kind: PickKind) => (arg: string) =>
      editor.insertInlineContent([
        { type: "embed", props: { kind, arg } },
        " ",
      ]);

    const items = (query: string) => {
      const mk = (
        title: string,
        subtext: string,
        onItemClick: () => void,
        aliases: string[] = [],
      ) => ({
        title,
        subtext,
        onItemClick,
        aliases,
        group: "Notebook",
      });
      const custom = [
        ...ADMONITION_KINDS.map((k) =>
          mk(
            `Admonition: ${k}`,
            `Callout box (:::${k})`,
            () => insertBlock(k),
            [k, "callout"],
          ),
        ),
        mk(
          "Raw block (details / tabs)",
          "Collapsible or tabbed content as Markdown",
          () =>
            editor.insertBlocks(
              [
                {
                  type: "rawmd",
                  props: { source: ":::details Summary\nHidden content\n:::" },
                },
              ],
              editor.getTextCursorPosition().block,
              "after",
            ),
          ["details", "tabs", "collapsible"],
        ),
        mk(
          "Citation",
          "{{cite:n}} IEEE-style reference",
          () => setPicker("cite"),
          ["cite", "reference"],
        ),
        mk(
          "Paper chip",
          "Link to a paper with hover card",
          () => setPicker("paper"),
          ["paper"],
        ),
        mk("Protein chip", "Link to a protein", () => setPicker("protein"), [
          "protein",
        ]),
        mk("Visualisation", "Embed a chart", () => setPicker("viz"), [
          "viz",
          "chart",
          "matrix",
        ]),
      ];
      return filterSuggestionItems(
        [...getDefaultReactSlashMenuItems(editor), ...custom] as never,
        query,
      );
    };

    return (
      <div
        className={`rich-editor rich-editor--${variant}`}
        aria-label={label}
        // Clicking the empty space around or below the text puts the cursor at the end, like a page.
        onMouseDown={(e) => {
          if (variant !== "inline" && e.target === e.currentTarget) {
            e.preventDefault();
            focusEnd();
          }
        }}
      >
        <BlockNoteView
          editor={editor}
          theme={theme}
          slashMenu={false}
          onChange={handleChange}
          data-testid="rich-editor"
        >
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (q) => items(q) as never}
          />
        </BlockNoteView>
        {variant === "page" && (
          <div className="rich-editor__hint">
            Type <kbd>/</kbd> for headings, lists, tables, code, images,
            callouts and embeds. Do not upload images containing
            participant-level data.
          </div>
        )}
        {picker && (
          <EmbedPicker
            kind={picker}
            onPick={insertEmbed(picker)}
            onClose={() => setPicker(null)}
          />
        )}
      </div>
    );
  },
);
