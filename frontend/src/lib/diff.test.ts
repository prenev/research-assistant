import { describe, expect, it } from "vitest";
import { diffLines, sideBySide } from "./diff";

describe("diffLines", () => {
  it("marks added, removed and unchanged lines", () => {
    expect(diffLines("a\nb\nc", "a\nB\nc")).toEqual([
      { type: "same", text: "a" },
      { type: "del", text: "b" },
      { type: "add", text: "B" },
      { type: "same", text: "c" },
    ]);
  });
  it("handles empty sides", () => {
    expect(diffLines("", "x")).toEqual([{ type: "add", text: "x" }]);
    expect(diffLines("x", "")).toEqual([{ type: "del", text: "x" }]);
    expect(diffLines("", "")).toEqual([]);
  });
});

describe("sideBySide", () => {
  it("pairs replaced lines on one row", () => {
    const rows = sideBySide("a\nb", "a\nc");
    expect(rows).toHaveLength(2);
    expect(rows[1].left?.text).toBe("b");
    expect(rows[1].right?.text).toBe("c");
  });
  it("leaves the other side empty for pure additions", () => {
    const rows = sideBySide("a", "a\nb");
    expect(rows[1].left).toBeUndefined();
    expect(rows[1].right?.text).toBe("b");
  });
});
