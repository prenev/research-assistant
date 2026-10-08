import { test } from "@playwright/test";
import { apiCall, expect, login, quickAdd, uid } from "./helpers";

const inEditor = () => document.activeElement?.closest(".bn-editor") !== null;

async function ownDoc(
  page: import("@playwright/test").Page,
  body = "## Heading\n\nFirst paragraph.",
) {
  const cats = await apiCall(page, "GET", "/doc-categories/");
  const slug = `feel-${uid()}`;
  await apiCall(page, "POST", "/doc-pages/", {
    title: "Feel page",
    slug,
    category: cats.results[0].id,
    body,
  });
  return slug;
}

test("the doc editor is a page, not a text box", async ({ page }) => {
  await login(page);
  const slug = await ownDoc(page);
  await page.goto(`/docs/${slug}`);
  await page.getByRole("button", { name: "Turn edit mode on" }).click();
  await page.getByRole("button", { name: "Edit content" }).click();
  await expect(page.locator(".bn-editor")).toBeVisible();

  // no box: no border or background around the writing area, and the title is plain text
  const look = await page.evaluate(() => {
    const css = (sel: string) => getComputedStyle(document.querySelector(sel)!);
    return {
      wrapBorder: css(".rich-editor").borderTopWidth,
      editorBg: css(".bn-editor").backgroundColor,
      titleBorder: css(".doc-editor__title").borderTopWidth,
      titleSize: css(".doc-editor__title").fontSize,
      barPosition: css(".doc-editor__bar").position,
    };
  });
  expect(look.wrapBorder).toBe("0px");
  expect(look.editorBg).toBe("rgba(0, 0, 0, 0)");
  expect(look.titleBorder).toBe("0px");
  expect(parseFloat(look.titleSize)).toBeGreaterThanOrEqual(30); // same size as the page heading
  expect(look.barPosition).toBe("sticky");

  // the table of contents steps aside while writing
  await expect(page.locator(".table-of-contents")).toBeHidden();

  // Enter in the title moves into the body, like Notion
  await page.locator(".doc-editor__title").click();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(inEditor)).toBe(true);

  // clicking the empty space below the text puts the cursor at the end of the page
  await page.keyboard.type("START ");
  const canvas = page.locator(".rich-editor--page");
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 25);
  expect(await page.evaluate(inEditor)).toBe(true);
  await page.keyboard.type(" THE END");

  // Ctrl+S saves
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+s");
  await expect(page.getByText("Page saved")).toBeVisible();
  await expect(page.locator("article")).toContainText("START");
  const saved = await apiCall(page, "GET", `/doc-pages/?slug=${slug}`);
  expect(saved.results[0].body.trim().endsWith("THE END")).toBe(true);
});

test("New doc page opens as a blank page with the cursor in the title, and its address follows the title", async ({
  page,
}) => {
  await login(page);
  await page.goto("/docs/research-question");
  await quickAdd(page, "New doc page");
  await expect(page).toHaveURL(/\/docs\/untitled/);
  const title = page.locator(".doc-editor__title");
  await expect(title).toBeFocused();
  await expect(title).toHaveValue("Untitled");

  const name = `Fresh page ${uid()}`;
  await page.keyboard.type(name); // the placeholder title was selected, so typing replaces it
  await page.keyboard.press("Enter");
  await page.keyboard.type("Body written straight away.");
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+s");

  const slug = name.toLowerCase().replace(/\s+/g, "-");
  await expect(page).toHaveURL(new RegExp(`/docs/${slug}$`));
  await expect(page.locator("article")).toContainText(
    "Body written straight away.",
  );
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  // it landed in the same section as the page we were reading
  await expect(
    page.getByRole("navigation", { name: "Breadcrumbs" }),
  ).toContainText("Start here");
});

test("New log post opens blank in the editor too", async ({ page }) => {
  await login(page);
  await quickAdd(page, "New log post");
  await expect(page).toHaveURL(/\/log\/.*untitled/);
  await expect(page.locator(".doc-editor__title")).toBeFocused();
  const name = `Journal club ${uid()}`;
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.keyboard.type("Discussed the first paper.");
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+s");
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  await expect(page).toHaveURL(new RegExp(`/log/.*${slug}$`));
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(page.locator("article")).toContainText(
    "Discussed the first paper.",
  );
});

test("notes on a paper are written in place, with a save bar only when needed", async ({
  page,
}) => {
  await login(page);
  const n = uid();
  const paper = await apiCall(page, "POST", "/papers/", {
    title: `Notes paper ${n}`,
    first_author_surname: `Note${n}`,
    year: 2024,
  });
  await page.goto(`/papers/${paper.slug}`);

  // read-only view shows no empty Notes section
  await expect(
    page.getByRole("heading", { name: "Notes", level: 2 }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Turn edit mode on" }).click();
  const notes = page.getByRole("region", { name: "Notes" });
  await expect(notes.locator(".bn-editor")).toBeVisible();
  await expect(notes.locator(".rich-editor")).toHaveCSS(
    "border-top-width",
    "0px",
  );
  await expect(page.locator(".note-bar")).toHaveCount(0); // nothing to save yet

  await notes.locator(".bn-editor").click();
  await page.keyboard.type("Worth re-reading the methods.");
  await expect(page.locator(".note-bar")).toBeVisible();

  // discard throws the change away
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.locator(".note-bar")).toHaveCount(0);
  await expect(notes).not.toContainText("Worth re-reading");

  // type again and save with the button
  await notes.locator(".bn-editor").click();
  await page.keyboard.type("Worth re-reading the methods.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Notes saved")).toBeVisible();
  await expect(page.locator(".note-bar")).toHaveCount(0);
  const saved = await apiCall(page, "GET", `/papers/${paper.id}/`);
  expect(saved.notes).toContain("Worth re-reading the methods.");

  // and with edit mode off it reads as normal text
  await page.getByRole("button", { name: "Turn edit mode off" }).click();
  await expect(
    page.getByRole("heading", { name: "Notes", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("Worth re-reading the methods.")).toBeVisible();
});

test("protein rationale can be written in place", async ({ page }) => {
  await login(page);
  const p = await apiCall(page, "POST", "/proteins/", {
    name: `Rationale protein ${uid()}`,
  });
  await page.goto(`/proteins/${p.slug}`);
  await page.getByRole("button", { name: "Turn edit mode on" }).click();
  const box = page.getByRole("region", { name: "Rationale" });
  await box.locator(".bn-editor").click();
  await page.keyboard.type("Reported higher in blood in several studies.");
  await page.keyboard.press("Control+s");
  await expect(page.getByText("Rationale saved")).toBeVisible();
  const saved = await apiCall(page, "GET", `/proteins/${p.id}/`);
  expect(saved.rationale).toContain("Reported higher in blood");
});
