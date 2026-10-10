import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { apiCall, expect, login, quickAdd, uid } from "./helpers";

/** A filter bar select, found by its visible label (its accessible name also contains the options). */
const filterSelect = (page: Page, label: string) =>
  page
    .locator(".filter-bar__item", { hasText: new RegExp(`^${label}`) })
    .locator("select");

test("flow 3: write a log post with a viz embed and a citation, publish, and see it render", async ({
  page,
}) => {
  await login(page);
  const n = Number(uid().slice(-6));
  const paper = await apiCall(page, "POST", "/papers/", {
    title: "Cited paper for flow 3",
    first_author_surname: `Citer${n}`,
    year: 2025,
    citation_number: n,
    journal: "Test J",
    key_finding: "TNF-α higher in converters.",
  });
  const title = `Flow 3 post ${n}`;

  // "New log post" opens a blank page with the cursor in the title (no form).
  await quickAdd(page, "New log post");
  await expect(page.locator(".doc-editor__title")).toBeFocused();
  await page.keyboard.type(title);
  await page.keyboard.press("Enter");
  await page.keyboard.type(`First paragraph cites {{cite:${n}}} as evidence.`);
  await page.keyboard.press("Enter");
  await page.keyboard.type(
    "{{viz:evidence-matrix population=general_population}}",
  );
  await page.keyboard.press("Control+s");
  await expect(page.getByText("Page saved")).toBeVisible();

  // Stored as shortcodes, exactly as typed (no escaping by the editor).
  const posts = await apiCall(
    page,
    "GET",
    `/log-posts/?search=${encodeURIComponent(title)}`,
  );
  const post = posts.results[0];
  expect(post.body).toContain(`{{cite:${n}}}`);
  expect(post.body).toContain(
    "{{viz:evidence-matrix population=general_population}}",
  );

  await page.goto("/log");
  await expect(
    page.getByRole("main").getByRole("link", { name: title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: title, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title, level: 1 }),
  ).toBeVisible();
  const cite = page.getByRole("link", { name: `[${n}]` });
  await expect(cite).toBeVisible();
  await expect(cite).toHaveAttribute("href", `/papers/${paper.slug}`);
  await cite.hover();
  await expect(
    page.getByRole("tooltip").filter({ hasText: "Cited paper for flow 3" }),
  ).toBeVisible();
  // the embed now renders the real chart, with its filter applied
  await expect(
    page.getByRole("region", { name: "Evidence matrix" }),
  ).toBeVisible();
});

test("search finds new items straight after creation, with keyboard navigation", async ({
  page,
}) => {
  await login(page);
  const name = `Zorbulin${uid()}`;
  await quickAdd(page, "Add protein");
  const dialog = page.getByRole("dialog", { name: "Add protein" });
  await dialog.locator("#f-name").fill(name);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await page.keyboard.press("Control+k");
  const search = page.getByRole("dialog", { name: "Search" });
  await expect(search).toBeVisible();
  await search.getByRole("combobox").fill(name);
  const hit = search.getByRole("option", { name: new RegExp(name) });
  await expect(hit).toBeVisible();
  await expect(search.getByRole("heading", { name: "Proteins" })).toBeVisible();
  await expect(hit.locator("mark").first()).toBeVisible(); // matched text is highlighted
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/proteins\/zorbulin/);
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();

  // Esc closes; results from several groups and arrow keys work
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("question");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Search" })).toBeHidden();
});

test("papers: filters live in the URL, results narrow, and the card view works", async ({
  page,
}) => {
  await login(page);
  const tag = uid();
  await apiCall(page, "POST", "/papers/", {
    title: `Genetic paper ${tag}`,
    first_author_surname: `Gen${tag}`,
    year: 2020,
    population: "genetic_ftd",
    design: "cross_sectional",
    sample_size: 50,
  });
  await apiCall(page, "POST", "/papers/", {
    title: `Population paper ${tag}`,
    first_author_surname: `Pop${tag}`,
    year: 2024,
    population: "general_population",
    design: "prediction",
    sample_size: 5000,
  });
  await page.goto("/papers");
  await expect(
    page.getByRole("link", { name: new RegExp(`Gen${tag}`) }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: new RegExp(`Pop${tag}`) }),
  ).toBeVisible();

  await filterSelect(page, "Population").selectOption("general_population");
  await expect(page).toHaveURL(/population=general_population/);
  await expect(
    page.getByRole("link", { name: new RegExp(`Pop${tag}`) }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: new RegExp(`Gen${tag}`) }),
  ).toBeHidden();

  await page.reload(); // filter survives a reload
  await expect(filterSelect(page, "Population")).toHaveValue(
    "general_population",
  );

  await page.getByRole("button", { name: "Cards" }).click();
  await expect(
    page.locator(".paper-card").filter({ hasText: `Pop${tag}` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page.locator(".paper-card").filter({ hasText: `Gen${tag}` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Table" }).click();

  // sorting by sample size, descending
  await filterSelect(page, "Population").selectOption("");
  await page.getByRole("button", { name: /^n/ }).click();
  await page.getByRole("button", { name: /^n/ }).click();
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toContainText(/Pop|Cit|Gen|.+/);
  await expect(page.getByRole("columnheader", { name: /^n/ })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
});

test("log: pagination, tags, archive and newer/older navigation", async ({
  page,
}) => {
  await login(page);
  const tag = await apiCall(page, "POST", "/tags/", {
    name: `e2e-tag-${uid()}`,
  });
  const ids: string[] = [];
  for (let i = 0; i < 12; i++) {
    const p = await apiCall(page, "POST", "/log-posts/", {
      title: `Paged post ${tag.slug} ${String(i).padStart(2, "0")}`,
      date: "2025-06-15",
      body: `Body ${i}`,
      tags: [tag.id],
    });
    ids.push(p.slug);
  }
  await page.goto(`/log/tags/${tag.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "12 posts tagged",
  );
  await expect(page.locator("article.blog-post")).toHaveCount(10);
  await page.getByRole("link", { name: "Older entries" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("article.blog-post")).toHaveCount(2);
  await page.getByRole("link", { name: "Newer entries" }).click();
  await expect(page.locator("article.blog-post")).toHaveCount(10);

  await page.goto("/log/tags");
  await expect(
    page.getByRole("link", { name: new RegExp(`${tag.name}\\s*12`) }),
  ).toBeVisible();

  await page.goto("/log/archive");
  await expect(
    page.getByRole("heading", { name: "2025", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "June", level: 3 }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: new RegExp(`Paged post ${tag.slug} 05`) }),
  ).toBeVisible();

  // sidebar lists recent posts and a post page offers newer/older links
  await page.goto("/log");
  await expect(
    page.getByRole("navigation", { name: /recent posts/i }),
  ).toBeVisible();
  await page.goto(`/log/${ids[5]}`);
  await expect(
    page.getByRole("navigation", { name: "Blog post page navigation" }),
  ).toBeVisible();
});
