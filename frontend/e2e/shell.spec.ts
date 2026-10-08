import { expect, test, type Page } from "@playwright/test";

// Needs the backend running with seed data and a user: E2E_USER / E2E_PASSWORD.
const user = process.env.E2E_USER ?? "owner";
const password = process.env.E2E_PASSWORD ?? "pw-12345-long";

async function login(page: Page) {
  await page.goto("/");
  await page.fill("#u", user);
  await page.fill("#p", password);
  await page.click("button[type=submit]");
  await page.waitForSelector(".hero");
}

test("flow 5: dark mode toggles and persists across reload", async ({
  page,
}) => {
  await login(page);
  const before = await page.getAttribute("html", "data-theme");
  await page.click(".navbar__items--right .toggle-button");
  const after = await page.getAttribute("html", "data-theme");
  expect(after).not.toBe(before);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", after!);
});

test("flow 6: mobile drawer opens and navigates the docs sidebar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await login(page);
  await page.goto("/docs/how-to-use");
  await page.click(".navbar__toggle");
  await expect(page.locator("nav.navbar")).toHaveClass(/navbar-sidebar--show/);
  await page.click(".navbar-sidebar button.menu__link");
  await expect(page.getByText("← Back to main menu")).toBeVisible();
  await page
    .locator(".navbar-sidebar")
    .getByRole("link", { name: "Data policy" })
    .click();
  await expect(page).toHaveURL(/\/docs\/data-policy$/);
  await expect(page.locator("nav.navbar")).not.toHaveClass(
    /navbar-sidebar--show/,
  );
});

test("docs: three-column layout, TOC and prev/next", async ({ page }) => {
  await login(page);
  await page.goto("/docs/research-question");
  await expect(page.locator(".doc-sidebar")).toBeVisible();
  await expect(page.locator(".table-of-contents")).toBeVisible();
  await page
    .locator("nav.pagination-nav")
    .getByRole("link", { name: /Next/ })
    .click();
  await expect(page).toHaveURL(/where-things-stand/);
});
