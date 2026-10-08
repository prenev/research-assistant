import { useMemo, useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useList, type Obj } from "../api/crud";
import { Badge } from "../components/Badge";
import { PaperChip, ProteinChip } from "../components/Embeds";
import { ItemActions } from "../components/ItemActions";
import { Markdown } from "../components/Markdown";
import { useForms } from "../forms/FormHost";
import {
  formatDate,
  fullBody,
  groupArchive,
  listPreview,
  paginate,
  readingMinutes,
  tagCounts,
} from "../lib/log";
import { Layout } from "../theme/Layout";
import { useEditMode } from "../theme/EditMode";
import { DocEditor } from "./DocEditor";

function useLogData() {
  const posts = useList("log-posts");
  const tags = useList("tags");
  const tagById = useMemo(
    () => new Map((tags.data ?? []).map((t) => [t.id, t])),
    [tags.data],
  );
  return { posts: posts.data ?? [], loading: posts.isLoading, tagById };
}

function TagList({
  ids,
  tagById,
}: {
  ids: number[];
  tagById: Map<number, Obj>;
}) {
  if (!ids.length) return null;
  return (
    <ul className="tags" aria-label="Tags">
      {ids.map((id) => {
        const t = tagById.get(id);
        return t ? (
          <li key={id}>
            <Link className="tag-pill" to={`/log/tags/${t.slug}`}>
              {t.name}
            </Link>
          </li>
        ) : null;
      })}
    </ul>
  );
}

function BlogLayout({
  title,
  children,
  posts,
}: {
  title: string;
  children: React.ReactNode;
  posts: Obj[];
}) {
  const { editing } = useEditMode();
  const { openForm } = useForms();
  return (
    <Layout title={title}>
      <div className="container margin-vert--lg">
        <div className="row">
          <aside className="col col--3">
            <nav
              className="blog-sidebar"
              aria-label="Blog recent posts navigation"
            >
              <div className="blog-sidebar__title">Recent posts</div>
              <ul className="blog-sidebar__list">
                {posts.slice(0, 10).map((p) => (
                  <li key={p.id}>
                    <Link to={`/log/${p.slug}`}>{p.title}</Link>
                  </li>
                ))}
              </ul>
              <ul className="blog-sidebar__links">
                <li>
                  <Link to="/log/tags">Tags</Link>
                </li>
                <li>
                  <Link to="/log/archive">Archive</Link>
                </li>
              </ul>
              {editing && (
                <button
                  type="button"
                  className="button button--primary button--sm margin-top--md"
                  onClick={() => openForm("logPost")}
                >
                  New log post
                </button>
              )}
            </nav>
          </aside>
          <main className="col col--7">{children}</main>
        </div>
      </div>
    </Layout>
  );
}

function Pager({
  page,
  pages,
  base,
}: {
  page: number;
  pages: number;
  base: string;
}) {
  if (pages <= 1) return null;
  const href = (p: number) => (p === 1 ? base : `${base}?page=${p}`);
  return (
    <nav className="pagination-nav" aria-label="Blog list page navigation">
      {page < pages ? (
        <Link
          className="pagination-nav__link pagination-nav__link--prev"
          to={href(page + 1)}
        >
          <div className="pagination-nav__label">Older entries</div>
        </Link>
      ) : (
        <span />
      )}
      {page > 1 && (
        <Link
          className="pagination-nav__link pagination-nav__link--next"
          to={href(page - 1)}
        >
          <div className="pagination-nav__label">Newer entries</div>
        </Link>
      )}
    </nav>
  );
}

function PostPreview({
  post,
  tagById,
}: {
  post: Obj;
  tagById: Map<number, Obj>;
}) {
  const { markdown, hasMore } = listPreview(post as never);
  return (
    <article className="blog-post margin-bottom--xl">
      <header>
        <h2 className="blog-post__title">
          <Link to={`/log/${post.slug}`}>{post.title}</Link>
        </h2>
        <div className="blog-post__meta margin-vert--md">
          <time dateTime={post.date}>{formatDate(post.date)}</time> ·{" "}
          {readingMinutes(post.body)} min read
        </div>
      </header>
      <Markdown source={markdown} />
      <footer className="row margin-vert--lg">
        <div className="col">
          <TagList ids={post.tags} tagById={tagById} />
        </div>
        {hasMore && (
          <div className="col text--right">
            <Link
              to={`/log/${post.slug}`}
              aria-label={`Read more about ${post.title}`}
            >
              <strong>Read more</strong>
            </Link>
          </div>
        )}
      </footer>
    </article>
  );
}

export function LogListPage() {
  const { posts, loading, tagById } = useLogData();
  const [params] = useSearchParams();
  const pg = paginate(posts, Number(params.get("page") ?? 1));
  return (
    <BlogLayout title="Log" posts={posts}>
      {loading ? (
        <p>Loading…</p>
      ) : posts.length === 0 ? (
        <div className="alert alert--info">
          No log posts yet. Turn on edit mode and choose “New log post”.
        </div>
      ) : (
        <>
          {pg.items.map((p) => (
            <PostPreview key={p.id} post={p} tagById={tagById} />
          ))}
          <Pager page={pg.page} pages={pg.pages} base="/log" />
        </>
      )}
    </BlogLayout>
  );
}

export function LogPostPage() {
  const { slug } = useParams();
  const { posts, loading, tagById } = useLogData();
  const { editing } = useEditMode();
  const navigate = useNavigate();
  const [editingBody, setEditingBody] = useState(false);
  const { data: papers } = useList("papers");
  const { data: proteins } = useList("proteins");
  const { data: stages } = useList("pipeline-stages");
  const i = posts.findIndex((p) => p.slug === slug);
  const post = posts[i];
  if (loading)
    return (
      <BlogLayout title="Log" posts={posts}>
        <p>Loading…</p>
      </BlogLayout>
    );
  if (!post)
    return (
      <BlogLayout title="Post not found" posts={posts}>
        <h1>Post not found</h1>
        <Link to="/log">Back to the log</Link>
      </BlogLayout>
    );
  const newer = posts[i - 1];
  const older = posts[i + 1];
  const linked = {
    papers: (papers ?? []).filter((p) => post.linked_papers.includes(p.id)),
    proteins: (proteins ?? []).filter((p) =>
      post.linked_proteins.includes(p.id),
    ),
    stages: (stages ?? []).filter((p) =>
      post.linked_pipeline_stages.includes(p.id),
    ),
  };
  return (
    <BlogLayout title={post.title} posts={posts}>
      <article className="blog-post">
        <header>
          <h1 className="blog-post__title">{post.title}</h1>
          <div className="blog-post__meta margin-vert--md">
            <time dateTime={post.date}>{formatDate(post.date)}</time> ·{" "}
            {readingMinutes(post.body)} min read
          </div>
          {editing && !editingBody && (
            <div className="doc-toolbar">
              <ItemActions
                model="logPost"
                item={post}
                onDeleted={() => navigate("/log")}
              />
              <button
                type="button"
                className="button button--primary button--sm"
                onClick={() => setEditingBody(true)}
              >
                Edit content
              </button>
            </div>
          )}
        </header>
        {editingBody ? (
          <DocEditor
            page={post as never}
            endpoint="log-posts"
            onDone={() => setEditingBody(false)}
          />
        ) : (
          <Markdown source={fullBody(post.body)} />
        )}
        <footer className="margin-vert--lg">
          <TagList ids={post.tags} tagById={tagById} />
          {(linked.papers.length > 0 ||
            linked.proteins.length > 0 ||
            linked.stages.length > 0) && (
            <div
              className="linked-chips margin-top--md"
              aria-label="Linked items"
            >
              {linked.papers.map((p) => (
                <PaperChip key={`p${p.id}`} paper={p as never} />
              ))}
              {linked.proteins.map((p) => (
                <ProteinChip key={`r${p.id}`} slug={p.slug} />
              ))}
              {linked.stages.map((s) => (
                <Link
                  key={`s${s.id}`}
                  className="badge badge--secondary chip"
                  to="/pipeline"
                >
                  {s.title}
                </Link>
              ))}
            </div>
          )}
        </footer>
      </article>
      {(newer || older) && (
        <nav className="pagination-nav" aria-label="Blog post page navigation">
          {newer ? (
            <Link
              className="pagination-nav__link pagination-nav__link--prev"
              to={`/log/${newer.slug}`}
            >
              <div className="pagination-nav__sublabel">Newer post</div>
              <div className="pagination-nav__label">{newer.title}</div>
            </Link>
          ) : (
            <span />
          )}
          {older && (
            <Link
              className="pagination-nav__link pagination-nav__link--next"
              to={`/log/${older.slug}`}
            >
              <div className="pagination-nav__sublabel">Older post</div>
              <div className="pagination-nav__label">{older.title}</div>
            </Link>
          )}
        </nav>
      )}
    </BlogLayout>
  );
}

export function LogTagsPage() {
  const { posts, tagById } = useLogData();
  const counts = tagCounts(posts as never);
  return (
    <BlogLayout title="Log tags" posts={posts}>
      <h1>Tags</h1>
      {counts.length === 0 ? (
        <p>No tags yet.</p>
      ) : (
        <ul className="tags tags--big">
          {counts.map((c) => {
            const t = tagById.get(c.id);
            return (
              t && (
                <li key={c.id}>
                  <Link className="tag-pill" to={`/log/tags/${t.slug}`}>
                    {t.name} <span className="tag-pill__count">{c.count}</span>
                  </Link>
                </li>
              )
            );
          })}
        </ul>
      )}
    </BlogLayout>
  );
}

export function LogTagPage() {
  const { slug } = useParams();
  const { posts, tagById } = useLogData();
  const tag = [...tagById.values()].find((t) => t.slug === slug);
  const [params] = useSearchParams();
  const mine = posts.filter((p) => tag && p.tags.includes(tag.id));
  const pg = paginate(mine, Number(params.get("page") ?? 1));
  return (
    <BlogLayout title={tag ? `Posts tagged ${tag.name}` : "Tag"} posts={posts}>
      <h1>
        {tag
          ? `${mine.length} post${mine.length === 1 ? "" : "s"} tagged “${tag.name}”`
          : "Tag not found"}
      </h1>
      <p>
        <Link to="/log/tags">View all tags</Link>
      </p>
      {pg.items.map((p) => (
        <PostPreview key={p.id} post={p} tagById={tagById} />
      ))}
      <Pager page={pg.page} pages={pg.pages} base={`/log/tags/${slug}`} />
    </BlogLayout>
  );
}

export function LogArchivePage() {
  const { posts } = useLogData();
  const years = groupArchive(
    posts as never as { date: string; slug: string; title: string }[],
  );
  return (
    <BlogLayout title="Log archive" posts={posts}>
      <h1>Archive</h1>
      <p>
        {posts.length} post{posts.length === 1 ? "" : "s"}
      </p>
      {years.map((y) => (
        <section key={y.year}>
          <h2>{y.year}</h2>
          {y.months.map((m) => (
            <div key={m.month}>
              <h3>{m.month}</h3>
              <ul>
                {m.posts.map((p) => (
                  <li key={p.slug}>
                    <Link to={`/log/${p.slug}`}>{p.title}</Link>{" "}
                    <small>{formatDate(p.date)}</small>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </BlogLayout>
  );
}

export const LogIndexRedirect = () => <Navigate to="/log" replace />;
export { Badge };
