import { BlockNoteEditor } from "@blocknote/core";
import { beforeAll, describe, expect, it } from "vitest";
import { blocksToMarkdown, markdownToBlocks } from "./convert";
import { schema } from "./schema";

let editor: unknown;
beforeAll(() => {
  editor = BlockNoteEditor.create({ schema });
});

async function roundTrip(md: string) {
  const blocks = await markdownToBlocks(editor as never, md);
  return blocksToMarkdown(editor as never, blocks);
}

describe("editor <-> markdown round trip", () => {
  it("keeps headings, paragraphs, lists and emphasis", async () => {
    const md = "## Title\n\nSome **bold** and *italic* text.\n\n* one\n* two\n";
    const out = await roundTrip(md);
    expect(out).toContain("## Title");
    expect(out).toContain("**bold**");
    expect(out).toContain("*italic*");
    expect(out).toMatch(/[*-] one/);
  });

  it("keeps citation and other shortcodes, including underscores", async () => {
    const md =
      "See {{cite:1,2}} and {{protein:tnf-alpha}}.\n\n{{viz:evidence-matrix population=general_population}}\n";
    const out = await roundTrip(md);
    expect(out).toContain("{{cite:1,2}}");
    expect(out).toContain("{{protein:tnf-alpha}}");
    expect(out).toContain(
      "{{viz:evidence-matrix population=general_population}}",
    );
  });

  it("turns shortcodes into embed inline nodes", async () => {
    const blocks = await markdownToBlocks(editor as never, "x {{cite:3}} y");
    const kinds = (blocks[0].content as { type: string }[]).map((n) => n.type);
    expect(kinds).toEqual(["text", "embed", "text"]);
  });

  it("round-trips simple admonitions with and without titles", async () => {
    const out = await roundTrip(
      ":::tip\nUse **it**.\n:::\n\n:::warning Careful\nBe careful.\n:::\n",
    );
    expect(out).toContain(":::tip\nUse **it**.\n:::");
    expect(out).toContain(":::warning Careful\nBe careful.\n:::");
  });

  it("preserves details and tabs exactly as raw blocks", async () => {
    const md =
      ":::details More\nhidden\n:::\n\n:::tabs\n::tab A\none\n::tab B\ntwo\n:::\n";
    const out = await roundTrip(md);
    expect(out).toContain(":::details More\nhidden\n:::");
    expect(out).toContain("::tab A\none\n::tab B\ntwo");
  });

  it("preserves complex admonitions (lists inside) as raw", async () => {
    const md = ":::note\n- a\n- b\n:::\n";
    expect(await roundTrip(md)).toContain(":::note\n- a\n- b\n:::");
  });

  it("keeps fenced code with title meta", async () => {
    const out = await roundTrip('```python title="x.py"\nprint(1)\n```\n');
    expect(out).toContain("print(1)");
    expect(out).toContain("```python");
  });

  it("keeps tables", async () => {
    const out = await roundTrip("| A | B |\n|---|---|\n| 1 | 2 |\n");
    expect(out).toMatch(/\|\s*A\s*\|\s*B\s*\|/);
  });

  it("is stable on second pass for the seeded how-to page style", async () => {
    const md =
      "## Embeds\n\n:::info Build status\nLater phases.\n:::\n\nSee {{cite:1}}.\n";
    const once = await roundTrip(md);
    expect(await roundTrip(once)).toBe(once);
  });
});
