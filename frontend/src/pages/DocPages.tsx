import { useEffect, useState } from "react";
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
  Link,
} from "react-router-dom";
import { useDocPage, useMe, useSidebar } from "../api/hooks";
import { ItemActions } from "../components/ItemActions";
import { useForms } from "../forms/FormHost";
import { useNewPage } from "../lib/useNewPage";
import { useEditMode } from "../theme/EditMode";
import { DocEditor } from "./DocEditor";
import type { SidebarCategory, SidebarItem } from "../api/types";
import { Markdown } from "../components/Markdown";
import { extractToc } from "../lib/markdown";
import { DocSidebar, flattenPages } from "../theme/DocSidebar";
import { Breadcrumbs, Paginator, Toc } from "../theme/DocLayout";
import { Layout } from "../theme/Layout";

function DocsShell({
  children,
  items,
}: {
  children: React.ReactNode;
  items: SidebarItem[];
}) {
  return (
    <div className="docs-wrapper">
      <DocSidebar items={items} />
      <main className="doc-main">{children}</main>
    </div>
  );
}

export function DocsIndex() {
  const { data } = useSidebar();
  const first = data && flattenPages(data)[0];
  if (!data)
    return (
      <Layout>
        <div className="container margin-vert--lg">Loading…</div>
      </Layout>
    );
  return first ? (
    <Navigate to={`/docs/${first.slug}`} replace />
  ) : (
    <Layout title="Docs">
      <p className="container margin-vert--lg">No docs yet.</p>
    </Layout>
  );
}

export function DocPageView() {
  const { slug } = useParams();
  const { data: sidebar } = useSidebar();
  const { data: page, isError, isLoading } = useDocPage(slug);
  const { data: me } = useMe();
  const { editing } = useEditMode();
  const { openForm } = useForms();
  const navigate = useNavigate();
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const isEditingThis = editingPage === slug;
  const [sp, setSp] = useSearchParams();
  const [isNew, setIsNew] = useState(false);
  const { newDocPage } = useNewPage();

  // A brand-new page arrives with ?edit=1: open the editor straight away, cursor in the title.
  useEffect(() => {
    if (sp.get("edit") === "1" && page && me?.authenticated) {
      setEditingPage(slug!);
      setIsNew(true);
      const next = new URLSearchParams(sp);
      next.delete("edit");
      setSp(next, { replace: true });
    }
  }, [page, me?.authenticated]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sidebar || isLoading)
    return (
      <Layout>
        <div className="container margin-vert--lg">Loading…</div>
      </Layout>
    );
  if (isError || !page)
    return (
      <Layout title="Page not found">
        <DocsShell items={sidebar}>
          <div className="container padding-vert--lg">
            <h1>Page not found</h1>
            <Link to="/docs">Back to docs</Link>
          </div>
        </DocsShell>
      </Layout>
    );
  const flat = flattenPages(sidebar);
  const i = flat.findIndex((p) => p.slug === page.slug);
  const prev = flat[i - 1];
  const next = flat[i + 1];
  const toc = extractToc(page.body);
  const hasH1 = /^#\s/m.test(page.body);
  return (
    <Layout title={page.title}>
      <DocsShell items={sidebar}>
        <div className="container padding-top--md padding-bottom--lg">
          <div className="row">
            <div
              className={`col doc-item-col${isEditingThis ? " doc-item-col--editing" : ""}`}
            >
              <Breadcrumbs trail={flat[i]?.trail ?? []} current={page.title} />
              {editing && !isEditingThis && (
                <div className="doc-toolbar">
                  <ItemActions
                    model="docPage"
                    item={page}
                    onDeleted={() => navigate("/docs")}
                  />
                  <button
                    type="button"
                    className="button button--primary button--sm"
                    onClick={() => setEditingPage(slug!)}
                  >
                    Edit content
                  </button>
                  <button
                    type="button"
                    className="button button--secondary button--sm"
                    onClick={() => newDocPage(page.category)}
                  >
                    New page here
                  </button>
                  <button
                    type="button"
                    className="button button--secondary button--sm"
                    onClick={() => openForm("docCategory")}
                  >
                    New category
                  </button>
                </div>
              )}
              {isEditingThis ? (
                <DocEditor
                  page={page}
                  focusTitle={isNew}
                  onDone={(newSlug) => {
                    setEditingPage(null);
                    setIsNew(false);
                    if (newSlug && newSlug !== slug)
                      navigate(`/docs/${newSlug}`, { replace: true });
                  }}
                />
              ) : (
                <article>
                  {!hasH1 && (
                    <header>
                      <h1>{page.title}</h1>
                    </header>
                  )}
                  <Markdown source={page.body} />
                </article>
              )}
              <footer className="doc-footer">
                <div className="row margin-top--sm">
                  <div className="col">
                    {me?.authenticated && (
                      <button
                        type="button"
                        className="clean-btn doc-footer__edit"
                        onClick={() => setEditingPage(slug!)}
                      >
                        ✎ Edit this page
                      </button>
                    )}
                  </div>
                  <div className="col text--right">
                    <em>
                      <small>
                        Last updated on{" "}
                        <b>
                          {new Date(page.updated_at).toLocaleDateString(
                            "en-GB",
                            { year: "numeric", month: "short", day: "numeric" },
                          )}
                        </b>
                        {page.last_edited_by_name && (
                          <>
                            {" "}
                            by <b>{page.last_edited_by_name}</b>
                          </>
                        )}
                      </small>
                    </em>
                  </div>
                </div>
              </footer>
              <Paginator
                prev={prev && { to: `/docs/${prev.slug}`, label: prev.title }}
                next={next && { to: `/docs/${next.slug}`, label: next.title }}
              />
            </div>
            <div
              className={`col col--3 toc-col${isEditingThis ? " toc-col--editing" : ""}`}
            >
              <Toc items={toc} />
            </div>
          </div>
        </div>
      </DocsShell>
    </Layout>
  );
}

function findCategory(
  items: SidebarItem[],
  slug: string,
  trail: SidebarCategory[] = [],
): { cat: SidebarCategory; trail: SidebarCategory[] } | null {
  for (const it of items) {
    if (it.type !== "category") continue;
    if (it.slug === slug) return { cat: it, trail };
    const r = findCategory(it.items, slug, [...trail, it]);
    if (r) return r;
  }
  return null;
}

export function DocCategoryView() {
  const { slug = "" } = useParams();
  const { data: sidebar } = useSidebar();
  if (!sidebar)
    return (
      <Layout>
        <div className="container margin-vert--lg">Loading…</div>
      </Layout>
    );
  const found = findCategory(sidebar, slug);
  return (
    <Layout title={found?.cat.title}>
      <DocsShell items={sidebar}>
        <div className="container padding-top--md padding-bottom--lg">
          <div className="row">
            <div className="col doc-item-col">
              {found ? (
                <>
                  <Breadcrumbs trail={found.trail} current={found.cat.title} />
                  <header>
                    <h1>{found.cat.title}</h1>
                  </header>
                  {found.cat.description && <p>{found.cat.description}</p>}
                  <section className="margin-top--lg">
                    <div className="row">
                      {found.cat.items.map((it) => (
                        <article
                          key={`${it.type}${it.id}`}
                          className="col col--6 margin-bottom--lg"
                        >
                          <Link
                            className="card padding--lg doc-card"
                            to={
                              it.type === "page"
                                ? `/docs/${it.slug}`
                                : `/docs/category/${it.slug}`
                            }
                          >
                            <h2 className="text--truncate" title={it.title}>
                              {it.type === "page" ? "📄️" : "🗃️"} {it.title}
                            </h2>
                            {it.type === "category" && (
                              <p className="text--truncate">
                                {it.items.length} items
                              </p>
                            )}
                          </Link>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <h1>Category not found</h1>
                  <Link to="/docs">Back to docs</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </DocsShell>
    </Layout>
  );
}
