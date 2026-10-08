import { describe, expect, it } from "vitest";
import {
  excerpt,
  highlightParts,
  makeFuse,
  searchGrouped,
  type SearchDoc,
} from "./search";

const docs: SearchDoc[] = [
  {
    type: "docs",
    title: "Research question",
    url: "/docs/research-question",
    context: "Overview",
    text: "Can a minimal panel improve prediction",
  },
  {
    type: "proteins",
    title: "TNF-α",
    url: "/proteins/tnf-alpha",
    context: "Cytokine",
    text: "TNFA tumour necrosis factor",
  },
  {
    type: "papers",
    title: "Plasma TNF predicts conversion",
    url: "/papers/x",
    context: "Malpetti 2025",
    text: "baseline TNF-α higher in converters",
  },
  {
    type: "log",
    title: "Notebook set up",
    url: "/log/n",
    context: "2026-10-08",
    text: "The notebook is set up.",
  },
];
const fuse = makeFuse(docs);

describe("searchGrouped", () => {
  it("groups hits in a fixed order", () => {
    const g = searchGrouped(fuse, "TNF");
    expect(g.map((x) => x.type)).toEqual(["papers", "proteins"]);
  });
  it("needs two characters and returns nothing for no match", () => {
    expect(searchGrouped(fuse, "t")).toEqual([]);
    expect(searchGrouped(fuse, "zzzzqqq")).toEqual([]);
  });
  it("matches titles ahead of body text", () => {
    const g = searchGrouped(fuse, "research");
    expect(g[0].hits[0].item.title).toBe("Research question");
  });
});

describe("highlightParts", () => {
  it("marks matched ranges and merges overlaps", () => {
    expect(
      highlightParts("hello world", [
        [0, 1],
        [1, 3],
        [6, 7],
      ]),
    ).toEqual([
      { text: "hell", hit: true },
      { text: "o ", hit: false },
      { text: "wo", hit: true },
      { text: "rld", hit: false },
    ]);
  });
  it("returns the text untouched without indices", () => {
    expect(highlightParts("abc", undefined)).toEqual([
      { text: "abc", hit: false },
    ]);
  });
});

describe("excerpt", () => {
  it("shows text around a body match", () => {
    const hit = searchGrouped(fuse, "converters")[0].hits[0];
    const ex = excerpt(hit)!;
    expect(ex.text).toContain("converters");
    const hl = highlightParts(ex.text, ex.indices)
      .filter((p) => p.hit)
      .map((p) => p.text.toLowerCase());
    expect(hl.join("")).toContain("converters");
  });
});
