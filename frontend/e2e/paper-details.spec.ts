import { test } from "@playwright/test";
import { expect, login, quickAdd, uid } from "./helpers";

test("study details: record them on a paper, see them on its page, filter by them, and search them", async ({
  page,
}) => {
  await login(page);
  const n = uid();
  const surname = `Detailed${n}`;
  const dataset = `Cohort${n}`;

  await quickAdd(page, "Add paper");
  const form = page.getByRole("dialog", { name: "Add paper" });
  await form.locator("#f-title").fill(`Study details paper ${n}`);
  await form.locator("#f-first_author_surname").fill(surname);
  await form.locator("#f-year").fill("2024");
  await form.locator("#f-condition_studied").selectOption("ftd");
  await form.getByText("bvFTD (behavioural variant)").click();
  await form.locator("#f-dataset").fill(dataset);
  await form
    .locator("#f-time_frame")
    .fill("Blood taken a median of 6 years before diagnosis");
  await form.locator("#f-nfl_involved").selectOption("compared");
  await form.locator("#f-case_identification").fill("Hospital records");
  await form.locator("#f-relevance").selectOption("core");
  await form.locator("#f-quality").selectOption("medium");
  await form
    .locator("#f-why_it_matters")
    .fill("Closest design to my own plan.");
  await form
    .locator("#f-methods_to_borrow")
    .fill("Nested cross-validation for model comparison.");
  await form
    .locator("#f-extra_details")
    .fill("Funding: none declared\nProteins measured: 1500");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toBeHidden();

  // the paper page shows everything that was entered
  await page.goto("/papers");
  await page.getByRole("link", { name: new RegExp(surname) }).click();
  const main = page.getByRole("main");
  await expect(
    main.getByRole("row", { name: /Condition studied.*Frontotemporal/ }),
  ).toBeVisible();
  await expect(
    main.getByRole("row", { name: /FTD subtypes.*bvFTD/ }),
  ).toBeVisible();
  await expect(
    main.getByRole("row", { name: new RegExp(`Cohort / dataset.*${dataset}`) }),
  ).toBeVisible();
  await expect(
    main.getByRole("row", { name: /Time frame.*6 years before diagnosis/ }),
  ).toBeVisible();
  await expect(
    main.getByRole("row", { name: /NfL.*NfL compared/ }),
  ).toBeVisible();
  await expect(
    main.getByRole("row", {
      name: /How cases were identified.*Hospital records/,
    }),
  ).toBeVisible();
  await expect(main.getByText("Closest design to my own plan.")).toBeVisible();
  await expect(
    main.getByRole("heading", { name: "Methods to borrow" }),
  ).toBeVisible();
  await expect(
    main.getByRole("row", { name: /Funding.*none declared/ }),
  ).toBeVisible();
  await expect(
    main.getByRole("row", { name: /Proteins measured.*1500/ }),
  ).toBeVisible();
  await expect(main.getByText("Core", { exact: true })).toBeVisible();

  // the list can be filtered by the new fields, and the choice lives in the URL
  const filterSelect = (label: string) =>
    page
      .locator(".filter-bar__item", { hasText: new RegExp(`^${label}`) })
      .locator("select");
  await page.goto("/papers");
  await filterSelect("NfL").selectOption("compared");
  await expect(page).toHaveURL(/nfl_involved=compared/);
  await expect(
    page.getByRole("link", { name: new RegExp(surname) }),
  ).toBeVisible();
  await filterSelect("NfL").selectOption("not_measured");
  await expect(
    page.getByRole("link", { name: new RegExp(surname) }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await filterSelect("FTD subtype").selectOption("bvftd");
  await expect(
    page.getByRole("link", { name: new RegExp(surname) }),
  ).toBeVisible();
  await filterSelect("FTD subtype").selectOption("svppa");
  await expect(
    page.getByRole("link", { name: new RegExp(surname) }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await filterSelect("Relevance").selectOption("core");
  await expect(
    page.getByRole("link", { name: new RegExp(surname) }),
  ).toBeVisible();
  await filterSelect("Condition").selectOption("alzheimers");
  await expect(
    page.getByRole("link", { name: new RegExp(surname) }),
  ).toBeHidden();

  // the dataset name is searchable
  await page.keyboard.press("Control+k");
  const search = page.getByRole("dialog", { name: "Search" });
  await search.getByRole("combobox").fill(dataset);
  await expect(
    search.getByRole("option", { name: new RegExp(surname) }),
  ).toBeVisible();
});

test("existing papers without study details still open and edit normally", async ({
  page,
}) => {
  await login(page);
  const n = uid();
  const res = await page.evaluate(async (n) => {
    const csrf = decodeURIComponent(
      document.cookie
        .split("; ")
        .find((c) => c.startsWith("csrftoken="))!
        .split("=")[1],
    );
    const r = await fetch("/api/v1/papers/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
      body: JSON.stringify({
        title: `Old style paper ${n}`,
        first_author_surname: `Old${n}`,
        year: 2020,
      }),
    });
    return r.json();
  }, n);
  await page.goto(`/papers/${res.slug}`);
  await expect(
    page.getByRole("heading", { name: `Old style paper ${n}` }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Methods to borrow" }),
  ).toHaveCount(0); // empty sections stay hidden
  await page.getByRole("button", { name: "Turn edit mode on" }).click();
  await page
    .getByRole("button", { name: new RegExp(`^Edit `) })
    .first()
    .click();
  const form = page.getByRole("dialog", { name: "Edit paper" });
  await form.locator("#f-relevance").selectOption("useful");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toBeHidden();
  await expect(
    page.getByRole("main").getByText("Useful", { exact: true }),
  ).toBeVisible();
});
