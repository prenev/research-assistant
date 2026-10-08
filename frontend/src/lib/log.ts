export const TRUNCATE = "<!-- truncate -->";
export const POSTS_PER_PAGE = 10;

export interface LogLike {
  id: number;
  slug: string;
  title: string;
  date: string;
  body: string;
  summary: string;
  tags: number[];
}

/** Body above the `<!-- truncate -->` marker, and whether a marker was present. */
export function splitTruncate(body: string): {
  preview: string;
  truncated: boolean;
} {
  const i = body.indexOf(TRUNCATE);
  return i === -1
    ? { preview: "", truncated: false }
    : { preview: body.slice(0, i).trim(), truncated: true };
}

/** What the list shows: the text above the marker, otherwise the summary (auto-made from the first paragraph). */
export function listPreview(post: Pick<LogLike, "body" | "summary">): {
  markdown: string;
  hasMore: boolean;
} {
  const { preview, truncated } = splitTruncate(post.body);
  if (truncated)
    return {
      markdown: preview,
      hasMore: post.body.replace(TRUNCATE, "").trim().length > preview.length,
    };
  const text = post.summary.trim();
  return { markdown: text, hasMore: post.body.trim().length > text.length };
}

/** Post body without the marker, for the full post page. */
export const fullBody = (body: string) =>
  body
    .replace(TRUNCATE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const readingMinutes = (body: string) =>
  Math.max(
    1,
    Math.round(fullBody(body).split(/\s+/).filter(Boolean).length / 200),
  );

export function paginate<T>(items: T[], page: number, size = POSTS_PER_PAGE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { items: items.slice((p - 1) * size, p * size), page: p, pages };
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Posts grouped by year then month, newest first. */
export function groupArchive<T extends Pick<LogLike, "date">>(posts: T[]) {
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));
  const years: { year: string; months: { month: string; posts: T[] }[] }[] = [];
  for (const p of sorted) {
    const [y, m] = p.date.split("-");
    let year = years.find((x) => x.year === y);
    if (!year) years.push((year = { year: y, months: [] }));
    const name = MONTHS[Number(m) - 1] ?? m;
    let month = year.months.find((x) => x.month === name);
    if (!month) year.months.push((month = { month: name, posts: [] }));
    month.posts.push(p);
  }
  return years;
}

/** Tag ids with how many posts use them, most used first. */
export function tagCounts(
  posts: Pick<LogLike, "tags">[],
): { id: number; count: number }[] {
  const m = new Map<number, number>();
  for (const p of posts) for (const t of p.tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id - b.id);
}

export const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
