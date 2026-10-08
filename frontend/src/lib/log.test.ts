import { describe, expect, it } from "vitest";
import {
  fullBody,
  groupArchive,
  listPreview,
  paginate,
  readingMinutes,
  splitTruncate,
  tagCounts,
} from "./log";

describe("truncate and preview", () => {
  it("cuts at the marker", () => {
    expect(splitTruncate("Intro.\n\n<!-- truncate -->\n\nRest.")).toEqual({
      preview: "Intro.",
      truncated: true,
    });
    expect(splitTruncate("No marker").truncated).toBe(false);
  });
  it("lists the text above the marker and says there is more", () => {
    const r = listPreview({
      body: "Intro.\n<!-- truncate -->\nMore text here.",
      summary: "Intro.",
    });
    expect(r).toEqual({ markdown: "Intro.", hasMore: true });
  });
  it("falls back to the summary, with no 'read more' for short posts", () => {
    expect(listPreview({ body: "Just this.", summary: "Just this." })).toEqual({
      markdown: "Just this.",
      hasMore: false,
    });
    expect(
      listPreview({ body: "First.\n\nSecond.", summary: "First." }).hasMore,
    ).toBe(true);
  });
  it("removes the marker from the full body", () => {
    expect(fullBody("A\n\n<!-- truncate -->\n\nB")).toBe("A\n\nB");
  });
  it("estimates reading time, at least a minute", () => {
    expect(readingMinutes("word ".repeat(450))).toBe(2);
    expect(readingMinutes("short")).toBe(1);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 23 }, (_, i) => i);
  it("slices pages and clamps", () => {
    expect(paginate(items, 1, 10).items).toHaveLength(10);
    expect(paginate(items, 3, 10)).toMatchObject({
      page: 3,
      pages: 3,
      items: [20, 21, 22],
    });
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, 0, 10).page).toBe(1);
    expect(paginate([], 1).pages).toBe(1);
  });
});

describe("archive and tags", () => {
  it("groups by year and month, newest first", () => {
    const g = groupArchive([
      { date: "2025-01-05" },
      { date: "2026-03-01" },
      { date: "2026-03-20" },
      { date: "2026-02-02" },
    ]);
    expect(g.map((y) => y.year)).toEqual(["2026", "2025"]);
    expect(g[0].months.map((m) => m.month)).toEqual(["March", "February"]);
    expect(g[0].months[0].posts.map((p) => p.date)).toEqual([
      "2026-03-20",
      "2026-03-01",
    ]);
  });
  it("counts tags", () => {
    expect(tagCounts([{ tags: [1, 2] }, { tags: [2] }, { tags: [] }])).toEqual([
      { id: 2, count: 2 },
      { id: 1, count: 1 },
    ]);
  });
});
