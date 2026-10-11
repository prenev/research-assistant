import { test } from "@playwright/test";
import { apiCall, expect, login, uid } from "./helpers";

async function doc(
  page: import("@playwright/test").Page,
  title: string,
  body = "",
) {
  const cats = await apiCall(page, "GET", "/doc-categories/");
  return apiCall(page, "POST", "/doc-pages/", {
    position: 9999, // keep these out of the docs' prev/next order
    title,
    category: cats.results[0].id,
    body,
  });
}

test("tags: create on the spot, coloured, browse across item types, narrow, edit, merge", async ({
  page,
}) => {
  await login(page);
  const n = uid();
  const paper = await apiCall(page, "POST", "/papers/", {
    title: `Tagged paper ${n}`,
    first_author_surname: `Tg${n}`,
    year: 2024,
  });
  const protein = await apiCall(page, "POST", "/proteins/", {
    name: `TagProt${n}`,
  });
  const alpha = `alpha-${n}`;
  const beta = `beta-${n}`;

  // type a brand new tag name on a paper: it is created and attached
  await page.goto(`/papers/${paper.slug}`);
  await page.getByRole("button", { name: "＋ Tag" }).click();
  await page.getByTestId("tag-input").fill(alpha);
  await expect(
    page.getByRole("option", { name: `Create “${alpha}”` }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  const chip = page
    .getByRole("list", { name: "Tags" })
    .getByRole("link", { name: alpha });
  await expect(chip).toBeVisible();
  // every tag has a colour from the start
  const colour = await chip.evaluate((el) =>
    (el as HTMLElement).style.getPropertyValue("--tag"),
  );
  expect(colour).toMatch(/^#[0-9a-f]{6}$/i);

  // reuse the existing tag on a protein, and add a second one there
  await page.goto(`/proteins/${protein.slug}`);
  await page.getByRole("button", { name: "＋ Tag" }).click();
  await page.getByTestId("tag-input").fill(alpha);
  await page.getByRole("option", { name: alpha }).click();
  await expect(page.getByRole("link", { name: alpha })).toBeVisible();
  // the box stays open so several tags can be added in a row
  await page.getByTestId("tag-input").fill(beta);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: beta })).toBeVisible();

  // browse: clicking a tag shows everything with it, across kinds
  await page.getByRole("link", { name: alpha }).click();
  await expect(page).toHaveURL(new RegExp(`tags=alpha-${n}`));
  const results = page.getByRole("region", { name: "Tagged items" });
  await expect(
    results.getByRole("link", { name: `Tagged paper ${n}` }),
  ).toBeVisible();
  await expect(
    results.getByRole("link", { name: `TagProt${n}` }),
  ).toBeVisible();
  // narrow by a tag that appears on the results: only the protein has both
  await results.getByRole("button", { name: new RegExp(`^${beta}`) }).click();
  await expect(
    results.getByRole("link", { name: `TagProt${n}` }),
  ).toBeVisible();
  await expect(
    results.getByRole("link", { name: `Tagged paper ${n}` }),
  ).toHaveCount(0);

  // edit: rename and recolour
  await page.goto("/tags");
  await page.getByRole("button", { name: `Edit tag ${alpha}` }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Name").fill(`renamed-${n}`);
  await dlg.getByRole("radio", { name: "#d6457a" }).click();
  await dlg.getByRole("button", { name: "Save" }).click();
  const renamed = page
    .getByRole("list", { name: "All tags" })
    .getByRole("button", { name: new RegExp(`^renamed-${n}`) });
  await expect(renamed).toBeVisible();
  expect(
    await renamed.evaluate((el) =>
      (el as HTMLElement).style.getPropertyValue("--tag"),
    ),
  ).toBe("#d6457a");

  // duplicate names are refused
  await page.getByRole("button", { name: `Edit tag ${beta}` }).click();
  await page.getByRole("dialog").getByLabel("Name").fill(`renamed-${n}`);
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");
  await page.keyboard.press("Escape");

  // merge beta into renamed: the protein keeps one tag, beta is gone
  await page.getByRole("button", { name: `Edit tag ${beta}` }).click();
  await page
    .getByLabel("Merge into another tag")
    .selectOption({ label: `renamed-${n}` });
  await page.getByRole("button", { name: "Merge", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Edit tag ${beta}` }),
  ).toHaveCount(0);
  const p = await apiCall(page, "GET", `/proteins/?slug=${protein.slug}`);
  expect(p.results[0].tags).toHaveLength(1);
});

test("wikilinks: resolve, show connections both ways, and create missing pages", async ({
  page,
}) => {
  await login(page);
  const n = uid();
  const target = await doc(page, `Target note ${n}`, "I am the target.");
  const source = await doc(
    page,
    `Source note ${n}`,
    `See [[Target note ${n}]] and [[Target note ${n}|the target]] and [[Missing idea ${n}]].`,
  );

  await page.goto(`/docs/${source.slug}`);
  const main = page.getByRole("main");
  await expect(
    main.getByRole("link", { name: `Target note ${n}`, exact: true }).first(),
  ).toHaveAttribute("href", `/docs/${target.slug}`);
  await expect(main.getByRole("link", { name: "the target" })).toBeVisible();
  await expect(
    main.getByRole("button", { name: `Missing idea ${n}` }),
  ).toBeVisible();
  // the source lists what it links to
  const conn = page.getByRole("complementary", { name: "Connections" });
  await expect(conn.getByRole("region", { name: "Links to" })).toContainText(
    `Target note ${n}`,
  );

  // the target shows who links to it, with the sentence around the link
  await page.goto(`/docs/${target.slug}`);
  const back = page
    .getByRole("complementary", { name: "Connections" })
    .getByRole("region", { name: "Linked from" });
  await expect(back).toContainText(`Source note ${n}`);
  await expect(back.locator("blockquote")).toContainText("See [[Target note");

  // clicking a missing link makes the page, titled as linked, ready to write in
  await page.goto(`/docs/${source.slug}`);
  await page.getByRole("button", { name: `Missing idea ${n}` }).click();
  await expect(page).toHaveURL(/edit=1/);
  await expect(page.locator(".doc-editor__title")).toHaveValue(
    `Missing idea ${n}`,
  );
  await page.getByRole("button", { name: "Save" }).click();
  await page.goto(`/docs/${source.slug}`);
  await expect(
    page.locator("a.wikilink", { hasText: `Missing idea ${n}` }),
  ).toBeVisible();
});

test("the @ menu links a note while writing, and it is saved as [[Title]]", async ({
  page,
}) => {
  await login(page);
  const n = uid();
  await doc(page, `Linkable ${n}`, "x");
  const writer = await doc(page, `Writer ${n}`, "Start");
  await page.goto(`/docs/${writer.slug}`);
  await page.getByRole("button", { name: "Turn edit mode on" }).click();
  await page.getByRole("button", { name: "Edit content" }).click();
  await page.locator(".bn-editor").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(` see @Linkable ${n}`);
  await expect(
    page.getByRole("option", { name: new RegExp(`Linkable ${n}`) }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Page saved")).toBeVisible();
  const saved = await apiCall(page, "GET", `/doc-pages/?slug=${writer.slug}`);
  expect(saved.results[0].body).toContain(`[[Linkable ${n}]]`);
});

test("notes graph: shows linked notes, wanted pages, filters by tag", async ({
  page,
}) => {
  await login(page);
  const n = uid();
  const a = await doc(
    page,
    `Graph A ${n}`,
    `[[Graph B ${n}]] and [[Never written ${n}]]`,
  );
  const b = await doc(page, `Graph B ${n}`, "b");
  const lone = await doc(page, `Graph Lone ${n}`, "alone");
  const tag = await apiCall(page, "POST", "/tags/", {
    name: `graphtag-${n}`,
    colour: "#1baf7a",
  });
  await apiCall(page, "PATCH", `/doc-pages/${a.id}/`, { tags: [tag.id] });

  await page.goto("/visualise/notes");
  await expect(
    page.locator("svg[data-export] [data-node]").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Wanted pages" }),
  ).toContainText(`Never written ${n}`);
  const orphans = page.getByRole("region", { name: "Unconnected notes" });
  const all = orphans.getByRole("button", { name: /^Show all/ });
  if (await all.count()) await all.click();
  await expect(orphans).toContainText(`Graph Lone ${n}`);
  expect(b.slug && lone.slug).toBeTruthy();

  // a note's fill is its first tag's colour
  await page.getByLabel("Find a node").fill(`Graph A ${n}`);
  const fills = await page.locator("svg[data-export] [data-node]").evaluateAll(
    (els, title) =>
      els
        .map((el) => ({
          text: el.textContent,
          fill: el.querySelector("circle,rect,polygon")?.getAttribute("fill"),
        }))
        .filter((x) => x.text?.includes(title as string)),
    `Graph A ${n}`,
  );
  expect(fills[0]?.fill).toBe("#1baf7a");

  // filtering by tag leaves only notes that have it
  await page.getByLabel("Find a node").fill("");
  await page
    .getByRole("list", { name: "Filter by tag" })
    .getByRole("button", { name: `graphtag-${n}` })
    .click();
  await page.getByLabel("Only linked notes").uncheck();
  await expect(page.locator("svg[data-export] [data-node]")).toHaveCount(1);

  // the graph can be embedded in a page
  const host = await doc(page, `Embed graph ${n}`, "{{viz:notes}}");
  await page.goto(`/docs/${host.slug}`);
  await expect(page.getByRole("region", { name: "Notes graph" })).toBeVisible();
});

test("the home page nudges you to write wanted pages and connect notes", async ({
  page,
}) => {
  await login(page);
  const n = uid();
  await doc(page, `Nudge ${n}`, `[[Nobody wrote this ${n}]]`);
  await page.goto("/");
  const section = page.getByRole("region", { name: "Your progress" });
  await expect(
    section.getByRole("link", {
      name: /linked pages? (is|are) not written yet/,
    }),
  ).toBeVisible();
});
