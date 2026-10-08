import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { SidebarCategory, SidebarItem } from "../api/types";

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
  return (
    <ul className="menu__list">
      {items.map((it) =>
        it.type === "page" ? (
          <li key={`p${it.id}`} className="menu__list-item">
            <Link
              className={`menu__link${pathname === `/docs/${it.slug}` ? " menu__link--active" : ""}`}
              to={`/docs/${it.slug}`}
              aria-current={
                pathname === `/docs/${it.slug}` ? "page" : undefined
              }
            >
              {it.title}
            </Link>
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
      </div>
      {expanded && <Items items={cat.items} depth={depth + 1} />}
    </li>
  );
}

export function DocSidebarMenu({ items }: { items: SidebarItem[] }) {
  return <Items items={items} depth={0} />;
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
