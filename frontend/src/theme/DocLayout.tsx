import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { SidebarCategory } from "../api/types";
import type { TocItem } from "../lib/markdown";

export function Breadcrumbs({
  trail,
  current,
}: {
  trail: SidebarCategory[];
  current?: string;
}) {
  return (
    <nav className="theme-doc-breadcrumbs" aria-label="Breadcrumbs">
      <ul className="breadcrumbs">
        <li className="breadcrumbs__item">
          <Link className="breadcrumbs__link" to="/" aria-label="Home page">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              aria-hidden="true"
              className="breadcrumbHome"
            >
              <path
                d="M10 19v-5h4v5c0 .55.45 1 1 1h3c.55 0 1-.45 1-1v-7h1.7c.46 0 .68-.57.33-.87L12.67 3.6c-.38-.34-.96-.34-1.34 0l-8.36 7.53c-.34.3-.13.87.33.87H5v7c0 .55.45 1 1 1h3c.55 0 1-.45 1-1z"
                fill="currentColor"
              />
            </svg>
          </Link>
        </li>
        {trail.map((c) => (
          <li key={c.id} className="breadcrumbs__item">
            <Link className="breadcrumbs__link" to={`/docs/category/${c.slug}`}>
              {c.title}
            </Link>
          </li>
        ))}
        {current && (
          <li className="breadcrumbs__item breadcrumbs__item--active">
            <span className="breadcrumbs__link">{current}</span>
          </li>
        )}
      </ul>
    </nav>
  );
}

export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const onScroll = () => {
      const offset = 60 + 16 + 8; // navbar + margin
      let cur: string | null = items[0]?.id ?? null;
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top - offset <= 0) cur = it.id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [items]);
  if (items.length === 0) return null;
  return (
    <div className="toc-wrap">
      <nav className="table-of-contents-wrap" aria-label="On this page">
        <div className="toc-title">On this page</div>
        <ul className="table-of-contents table-of-contents__left-border">
          {items.map((it) => (
            <li
              key={it.id}
              style={it.level === 3 ? { marginLeft: "1rem" } : undefined}
            >
              <a
                href={`#${it.id}`}
                className={`table-of-contents__link${active === it.id ? " table-of-contents__link--active" : ""}`}
              >
                {it.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function Paginator({
  prev,
  next,
}: {
  prev?: { to: string; label: string };
  next?: { to: string; label: string };
}) {
  if (!prev && !next) return null;
  return (
    <nav className="pagination-nav docusaurus-mt-lg" aria-label="Docs pages">
      {prev ? (
        <Link
          className="pagination-nav__link pagination-nav__link--prev"
          to={prev.to}
        >
          <div className="pagination-nav__sublabel">Previous</div>
          <div className="pagination-nav__label">{prev.label}</div>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          className="pagination-nav__link pagination-nav__link--next"
          to={next.to}
        >
          <div className="pagination-nav__sublabel">Next</div>
          <div className="pagination-nav__label">{next.label}</div>
        </Link>
      )}
    </nav>
  );
}
