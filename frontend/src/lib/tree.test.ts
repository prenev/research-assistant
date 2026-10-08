import { describe, expect, it } from "vitest";
import type { SidebarCategory, SidebarItem } from "../api/types";
import { moveBy, moveNode, reorderPayload } from "./tree";

const page = (id: number): SidebarItem => ({
  type: "page",
  id,
  slug: `p${id}`,
  title: `P${id}`,
  position: 0,
});
const cat = (id: number, items: SidebarItem[]): SidebarCategory => ({
  type: "category",
  id,
  slug: `c${id}`,
  title: `C${id}`,
  description: "",
  position: 0,
  collapsed: false,
  items,
});
const ids = (l: SidebarItem[]) => l.map((i) => `${i.type[0]}${i.id}`);
const tree = () => [cat(1, [page(1), page(2)]), cat(2, [page(3)])];

describe("moveNode", () => {
  it("moves a page before another page in a different category", () => {
    const t = moveNode(
      tree(),
      { type: "page", id: 3 },
      { type: "page", id: 2 },
      "before",
    )!;
    expect(ids((t[0] as SidebarCategory).items)).toEqual(["p1", "p3", "p2"]);
    expect(ids((t[1] as SidebarCategory).items)).toEqual([]);
  });
  it("moves a page inside a category (appended)", () => {
    const t = moveNode(
      tree(),
      { type: "page", id: 1 },
      { type: "category", id: 2 },
      "inside",
    )!;
    expect(ids((t[1] as SidebarCategory).items)).toEqual(["p3", "p1"]);
  });
  it("treats before/after a root category as inside when moving a page", () => {
    const t = moveNode(
      tree(),
      { type: "page", id: 1 },
      { type: "category", id: 2 },
      "before",
    )!;
    expect(ids(t)).toEqual(["c1", "c2"]);
    expect(ids((t[1] as SidebarCategory).items)).toContain("p1");
  });
  it("reorders root categories", () => {
    const t = moveNode(
      tree(),
      { type: "category", id: 2 },
      { type: "category", id: 1 },
      "before",
    )!;
    expect(ids(t)).toEqual(["c2", "c1"]);
  });
  it("refuses to move a category into itself or a descendant", () => {
    const t = [cat(1, [cat(2, [page(1)])])];
    expect(
      moveNode(
        t,
        { type: "category", id: 1 },
        { type: "category", id: 2 },
        "inside",
      ),
    ).toBeNull();
    expect(
      moveNode(
        t,
        { type: "category", id: 1 },
        { type: "page", id: 1 },
        "after",
      ),
    ).toBeNull();
    expect(
      moveNode(
        t,
        { type: "category", id: 1 },
        { type: "category", id: 1 },
        "inside",
      ),
    ).toBeNull();
  });
  it("does not mutate the input", () => {
    const t = tree();
    moveNode(t, { type: "page", id: 1 }, { type: "page", id: 3 }, "after");
    expect(ids((t[0] as SidebarCategory).items)).toEqual(["p1", "p2"]);
  });
});

describe("moveBy / reorderPayload", () => {
  it("swaps with a neighbour and stops at the ends", () => {
    const t = moveBy(tree(), { type: "page", id: 2 }, -1)!;
    expect(ids((t[0] as SidebarCategory).items)).toEqual(["p2", "p1"]);
    expect(moveBy(tree(), { type: "page", id: 1 }, -1)).toBeNull();
    expect(moveBy(tree(), { type: "page", id: 2 }, 1)).toBeNull();
  });
  it("emits parent and position for everything", () => {
    expect(reorderPayload(tree())).toEqual([
      { type: "category", id: 1, parent: null, position: 0 },
      { type: "page", id: 1, parent: 1, position: 0 },
      { type: "page", id: 2, parent: 1, position: 1 },
      { type: "category", id: 2, parent: null, position: 1 },
      { type: "page", id: 3, parent: 2, position: 0 },
    ]);
  });
});
