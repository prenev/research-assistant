import { describe, expect, it } from "vitest";
import {
  extractToc,
  parseBlocks,
  parseCodeMeta,
  transformEmbeds,
} from "./markdown";

describe("transformEmbeds", () => {
  it("rewrites shortcodes", () => {
    expect(transformEmbeds("see {{cite:1,2}} and {{protein:tnf-alpha}}")).toBe(
      "see [cite](#embed:cite:1%2C2) and [protein](#embed:protein:tnf-alpha)",
    );
  });
  it("leaves code alone", () => {
    const t = "`{{cite:1}}`\n```\n{{cite:2}}\n```\n";
    expect(transformEmbeds(t)).toBe(t);
  });
  it("keeps viz params", () => {
    expect(
      transformEmbeds("{{viz:evidence-matrix population=general_population}}"),
    ).toContain("#embed:viz:evidence-matrix%20population%3Dgeneral_population");
  });
});

describe("parseBlocks", () => {
  it("parses admonitions with and without titles", () => {
    const b = parseBlocks(
      "a\n:::tip\nbody\n:::\n:::warning Careful\nx\n:::\nz",
    );
    expect(b.map((x) => x.type)).toEqual([
      "md",
      "admonition",
      "admonition",
      "md",
    ]);
    expect(b[1]).toMatchObject({ kind: "tip", title: "TIP", body: "body" });
    expect(b[2]).toMatchObject({ kind: "warning", title: "Careful" });
  });
  it("nests via extra colons", () => {
    const b = parseBlocks("::::note\n:::tip\ninner\n:::\n::::");
    expect(b).toHaveLength(1);
    expect((b[0] as { body: string }).body).toBe(":::tip\ninner\n:::");
  });
  it("ignores containers inside code fences", () => {
    expect(parseBlocks("```\n:::note\nx\n:::\n```")).toHaveLength(1);
  });
  it("parses details and tabs", () => {
    const b = parseBlocks(
      ":::details More\nhidden\n:::\n:::tabs\n::tab A\none\n::tab B\ntwo\n:::",
    );
    expect(b[0]).toMatchObject({ type: "details", title: "More" });
    expect(b[1]).toMatchObject({
      type: "tabs",
      tabs: [
        { label: "A", body: "one" },
        { label: "B", body: "two" },
      ],
    });
  });
});

describe("extractToc", () => {
  it("returns h2/h3 with slugs and skips code", () => {
    const toc = extractToc(
      "# T\n## One\n### Two\n#### no\n```\n## code\n```\n## One",
    );
    expect(toc).toEqual([
      { id: "one", text: "One", level: 2 },
      { id: "two", text: "Two", level: 3 },
      { id: "one-1", text: "One", level: 2 },
    ]);
  });
});

describe("parseCodeMeta", () => {
  it("reads title and highlighted lines", () => {
    const m = parseCodeMeta('title="a.py" {1,3-4}');
    expect(m.title).toBe("a.py");
    expect([...m.highlight]).toEqual([1, 3, 4]);
  });
});
