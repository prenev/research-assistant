import { test } from "@playwright/test";
import { expect, login } from "./helpers";

const svg = (label: string, fill: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200'><rect width='300' height='200' fill='${fill}'/><text x='20' y='110' font-size='28'>${label}</text></svg>`)}`;

const ARTICLE = {
  found: true,
  title: "Tumor necrosis factor",
  summary:
    "Tumor necrosis factor is a cytokine involved in systemic inflammation.\n\nIt is produced mainly by macrophages.",
  sections: [{ title: "Function", text: "TNF regulates immune cells." }],
  images: [
    {
      title: "File:TNF_structure.png",
      caption: "TNF structure",
      thumb: svg("structure", "#9cf"),
      full: svg("structure large", "#9cf"),
    },
    {
      title: "File:TNF_pathway.png",
      caption: "TNF pathway",
      thumb: svg("pathway", "#fc9"),
      full: svg("pathway large", "#fc9"),
    },
  ],
  matched_by: "search",
  source_url: "https://en.wikipedia.org/wiki/Tumor_necrosis_factor",
  license: {
    name: "CC BY-SA 4.0",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  attribution:
    "Text and images from Wikipedia and Wikimedia Commons, available under CC BY-SA 4.0 (some images have other free licences).",
};

test("tapping Info shows the protein's article and images inside the app", async ({
  page,
}) => {
  const external: string[] = [];
  page.on(
    "request",
    (r) =>
      /wikipedia\.org|wikimedia\.org/.test(r.url()) && external.push(r.url()),
  );
  let popups = 0;
  page.on("popup", () => popups++);
  await page.route("**/api/v1/proteins/*/wikipedia/", (route) =>
    route.fulfill({ json: ARTICLE }),
  );

  await login(page);
  await page.goto("/proteins");
  await page.getByRole("button", { name: "About TNF-α" }).click();

  const info = page.getByRole("dialog", { name: "About TNF-α" });
  await expect(
    info.getByRole("heading", { name: "Tumor necrosis factor" }),
  ).toBeVisible();
  await expect(
    info.getByText("a cytokine involved in systemic inflammation"),
  ).toBeVisible();
  await expect(
    info.getByText("It is produced mainly by macrophages."),
  ).toBeVisible();
  await expect(
    info.getByRole("img", { name: "TNF structure" }).first(),
  ).toBeVisible();
  await expect(info.getByText("CC BY-SA 4.0").first()).toBeVisible(); // attribution is shown

  // sections open in place
  await info.getByText("Function", { exact: true }).click();
  await expect(info.getByText("TNF regulates immune cells.")).toBeVisible();

  // tapping an image opens it larger, in the app; Esc closes just the image view
  await info
    .getByRole("button", { name: "Enlarge image: TNF pathway" })
    .click();
  const box = page.getByRole("dialog", { name: "TNF pathway" });
  await expect(box.getByRole("img", { name: "TNF pathway" })).toBeVisible();
  await box.getByRole("button", { name: "Next →" }).click();
  await expect(
    page.getByRole("dialog", { name: "TNF structure" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "TNF structure" }),
  ).toBeHidden();
  await expect(info).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(info).toBeHidden();

  expect(page.url()).toContain("/proteins"); // never navigated away
  expect(popups).toBe(0);
  expect(external).toEqual([]); // the browser never contacted Wikipedia itself
});

test("the profile page shows the background inline, and handles 'no article' and 'unreachable'", async ({
  page,
}) => {
  let mode: "found" | "none" | "down" = "found";
  await page.route("**/api/v1/proteins/*/wikipedia/", (route) =>
    route.fulfill({
      json:
        mode === "found"
          ? ARTICLE
          : mode === "none"
            ? {
                found: false,
                detail: "No matching Wikipedia article was found.",
              }
            : {
                found: false,
                error: "unreachable",
                detail: "Could not reach Wikipedia.",
              },
    }),
  );
  await login(page);
  await page.goto("/proteins/tnf-alpha");
  await expect(
    page.getByRole("heading", { name: "About this protein" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tumor necrosis factor" }),
  ).toBeVisible();
  await expect(page.getByText("Found automatically.")).toBeVisible();

  mode = "none";
  await page.goto("/proteins/il-6");
  await expect(
    page.getByText("No Wikipedia article was found for IL-6."),
  ).toBeVisible();

  mode = "down";
  await page.goto("/proteins/gfap");
  await expect(page.getByText(/could not be reached/i)).toBeVisible();
  mode = "found";
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Tumor necrosis factor" }),
  ).toBeVisible();
});

test("the Wikipedia title can be set from the protein form", async ({
  page,
}) => {
  await login(page);
  await page.goto("/proteins");
  await page.getByRole("button", { name: "Turn edit mode on" }).click();
  await page.getByRole("button", { name: "Edit NfL" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit protein" });
  await dialog
    .getByLabel("Wikipedia article title")
    .fill("Neurofilament light chain");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  const res = await page.evaluate(() =>
    fetch("/api/v1/proteins/?slug=nfl").then((r) => r.json()),
  );
  expect(res.results[0].wikipedia_title).toBe("Neurofilament light chain");
});
