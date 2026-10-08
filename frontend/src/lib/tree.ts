import type { SidebarCategory, SidebarItem } from "../api/types";

export type Ref = { type: "page" | "category"; id: number };
export type Zone = "before" | "after" | "inside";
export interface ReorderItem {
  type: "page" | "category";
  id: number;
  parent: number | null;
  position: number;
}

const same = (a: Ref, b: Ref) => a.type === b.type && a.id === b.id;

function locate(
  list: SidebarItem[],
  ref: Ref,
  parent: SidebarCategory | null = null,
): {
  list: SidebarItem[];
  index: number;
  parent: SidebarCategory | null;
} | null {
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (same(it, ref)) return { list, index: i, parent };
    if (it.type === "category") {
      const r = locate(it.items, ref, it);
      if (r) return r;
    }
  }
  return null;
}

function contains(cat: SidebarCategory, ref: Ref): boolean {
  return cat.items.some(
    (i) => same(i, ref) || (i.type === "category" && contains(i, ref)),
  );
}

/** Returns a new tree with `drag` moved relative to `target`, or null if the move is not allowed. */
export function moveNode(
  tree: SidebarItem[],
  drag: Ref,
  target: Ref,
  zone: Zone,
): SidebarItem[] | null {
  if (same(drag, target)) return null;
  const root = structuredClone(tree);
  const from = locate(root, drag);
  const to = locate(root, target);
  if (!from || !to) return null;
  const node = from.list[from.index];
  if (
    node.type === "category" &&
    (contains(node, target) || same(node, target))
  )
    return null;

  // Pages cannot sit at the top level, so before/after a root category means "inside" it.
  let z = zone;
  if (node.type === "page" && to.parent === null && z !== "inside")
    z = "inside";
  if (z === "inside" && target.type !== "category") z = "after";

  from.list.splice(from.index, 1);
  if (z === "inside") {
    const dest = locate(root, target)!;
    (dest.list[dest.index] as SidebarCategory).items.push(node);
  } else {
    const dest = locate(root, target)!;
    dest.list.splice(dest.index + (z === "after" ? 1 : 0), 0, node);
  }
  return root;
}

/** Move one step up (-1) or down (+1) among its siblings. */
export function moveBy(
  tree: SidebarItem[],
  ref: Ref,
  delta: -1 | 1,
): SidebarItem[] | null {
  const root = structuredClone(tree);
  const at = locate(root, ref);
  if (!at) return null;
  const j = at.index + delta;
  if (j < 0 || j >= at.list.length) return null;
  [at.list[at.index], at.list[j]] = [at.list[j], at.list[at.index]];
  return root;
}

/** Every item with its parent and position, ready for POST /sidebar/reorder/. */
export function reorderPayload(tree: SidebarItem[]): ReorderItem[] {
  const out: ReorderItem[] = [];
  const walk = (list: SidebarItem[], parent: number | null) =>
    list.forEach((it, position) => {
      out.push({ type: it.type, id: it.id, parent, position });
      if (it.type === "category") walk(it.items, it.id);
    });
  walk(tree, null);
  return out;
}
