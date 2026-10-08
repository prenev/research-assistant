import {
  createContext,
  useContext,
  useEffect,
  useState,
  type DragEvent,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { post } from "../api/client";
import type { SidebarCategory, SidebarItem } from "../api/types";
import { useFeedback } from "../components/Feedback";
import {
  moveBy,
  moveNode,
  reorderPayload,
  type Ref,
  type Zone,
} from "../lib/tree";
import { useEditMode } from "./EditMode";

export function flattenPages(
  items: SidebarItem[],
): { slug: string; title: string; trail: SidebarCategory[] }[] {
  const out: { slug: string; title: string; trail: SidebarCategory[] }[] = [];
  const walk = (list: SidebarItem[], trail: SidebarCategory[]) => {
    for (const it of list) {
      if (it.type === "page")
        out.push({ slug: it.slug, title: it.title, trail });
      else walk(it.items, [...trail, it]);
    }
  };
  walk(items, []);
  return out;
}

interface Reorder {
  tree: SidebarItem[];
  editing: boolean;
  move: (drag: Ref, target: Ref, zone: Zone) => void;
  step: (ref: Ref, delta: -1 | 1) => void;
}
const ReorderCtx = createContext<Reorder | null>(null);

function useReorderState(tree: SidebarItem[]): Reorder {
  const { editing } = useEditMode();
  const qc = useQueryClient();
  const { toast } = useFeedback();
  const apply = async (next: SidebarItem[] | null, blocked: string) => {
    if (!next) return toast(blocked, "error");
    qc.setQueryData(["sidebar"], next); // optimistic
    try {
      await post("/sidebar/reorder/", { items: reorderPayload(next) });
    } catch {
      toast("Could not save the new order", "error");
    }
    qc.invalidateQueries({ queryKey: ["sidebar"] });
  };
  return {
    tree,
    editing,
    move: (drag, target, zone) =>
      apply(moveNode(tree, drag, target, zone), "That move is not allowed."),
    step: (ref, delta) => {
      const next = moveBy(tree, ref, delta);
      if (next) apply(next, "");
    },
  };
}

function EditControls({ r }: { r: Ref }) {
  const ctx = useContext(ReorderCtx)!;
  const name = (d: string) => `Move ${r.type} ${d}`;
  return (
    <span className="sidebar-edit">
      <button
        type="button"
        className="clean-btn"
        aria-label={name("up")}
        title={name("up")}
        onClick={() => ctx.step(r, -1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="clean-btn"
        aria-label={name("down")}
        title={name("down")}
        onClick={() => ctx.step(r, 1)}
      >
        ↓
      </button>
    </span>
  );
}

const DRAG_TYPE = "application/x-notebook-node";
function dragProps(ctx: Reorder | null, ref: Ref, allowInside: boolean) {
  if (!ctx?.editing) return {};
  const zoneOf = (e: DragEvent<HTMLElement>): Zone => {
    const box = e.currentTarget.getBoundingClientRect();
    const f = (e.clientY - box.top) / Math.max(box.height, 1);
    if (allowInside && f > 0.3 && f < 0.7) return "inside";
    return f < 0.5 ? "before" : "after";
  };
  return {
    draggable: true,
    onDragStart: (e: DragEvent<HTMLElement>) => {
      e.stopPropagation();
      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(ref));
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget;
      el.dataset.drop = zoneOf(e);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      delete e.currentTarget.dataset.drop;
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const zone = zoneOf(e);
      delete e.currentTarget.dataset.drop;
      const raw = e.dataTransfer.getData(DRAG_TYPE);
      if (raw) ctx.move(JSON.parse(raw) as Ref, ref, zone);
    },
  };
}

function containsPath(cat: SidebarCategory, pathname: string): boolean {
  return (
    pathname === `/docs/category/${cat.slug}` ||
    cat.items.some((i) =>
      i.type === "page"
        ? pathname === `/docs/${i.slug}`
        : containsPath(i, pathname),
    )
  );
}

function Items({ items, depth }: { items: SidebarItem[]; depth: number }) {
  const { pathname } = useLocation();
  const ctx = useContext(ReorderCtx);
  return (
    <ul className="menu__list">
      {items.map((it) =>
        it.type === "page" ? (
          <li
            key={`p${it.id}`}
            className="menu__list-item menu__list-item--editable"
            {...dragProps(ctx, it, false)}
          >
            <Link
              className={`menu__link${pathname === `/docs/${it.slug}` ? " menu__link--active" : ""}`}
              to={`/docs/${it.slug}`}
              aria-current={
                pathname === `/docs/${it.slug}` ? "page" : undefined
              }
            >
              {it.title}
            </Link>
            {ctx?.editing && <EditControls r={it} />}
          </li>
        ) : (
          <Category key={`c${it.id}`} cat={it} depth={depth} />
        ),
      )}
    </ul>
  );
}

function Category({ cat, depth }: { cat: SidebarCategory; depth: number }) {
  const { pathname } = useLocation();
  const ctx = useContext(ReorderCtx);
  const active = containsPath(cat, pathname);
  const [expanded, setExpanded] = useState(!cat.collapsed || active);
  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);
  return (
    <li
      className={`menu__list-item${expanded ? "" : " menu__list-item--collapsed"}`}
    >
      <div className="menu__list-item-collapsible">
        <Link
          className={`menu__link menu__link--sublist${pathname === `/docs/category/${cat.slug}` ? " menu__link--active" : ""}`}
          to={`/docs/category/${cat.slug}`}
          aria-expanded={expanded}
          onClick={() =>
            setExpanded((e) =>
              pathname === `/docs/category/${cat.slug}` ? !e : true,
            )
          }
        >
          {cat.title}
        </Link>
        <button
          type="button"
          aria-label={`${expanded ? "Collapse" : "Expand"} sidebar category '${cat.title}'`}
          aria-expanded={expanded}
          className="clean-btn menu__caret"
          onClick={() => setExpanded((e) => !e)}
        />
        {ctx?.editing && <EditControls r={cat} />}
      </div>
      {expanded && <Items items={cat.items} depth={depth + 1} />}
    </li>
  );
}

export function DocSidebarMenu({ items }: { items: SidebarItem[] }) {
  const state = useReorderState(items);
  return (
    <ReorderCtx.Provider value={state}>
      <Items items={items} depth={0} />
    </ReorderCtx.Provider>
  );
}

export function DocSidebar({ items }: { items: SidebarItem[] }) {
  const [hidden, setHidden] = useState(false);
  return (
    <>
      <aside
        className={`doc-sidebar${hidden ? " doc-sidebar--hidden" : ""}`}
        aria-label="Docs sidebar"
      >
        <nav className="menu thin-scrollbar doc-sidebar__menu">
          <DocSidebarMenu items={items} />
        </nav>
        <button
          type="button"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
          className="button button--secondary button--outline doc-sidebar__collapse"
          onClick={() => setHidden(true)}
        >
          «
        </button>
      </aside>
      {hidden && (
        <div
          className="doc-sidebar__expand"
          role="presentation"
          onClick={() => setHidden(false)}
        >
          <button
            type="button"
            className="clean-btn"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            »
          </button>
        </div>
      )}
    </>
  );
}
