import { expect, test, type Page } from "@playwright/test";

const user = process.env.E2E_USER ?? "owner";
const password = process.env.E2E_PASSWORD ?? "pw-12345-long";

async function login(page: Page) {
  await page.goto("/");
  await page.fill("#u", user);
  await page.fill("#p", password);
  await page.click("button[type=submit]");
  await page.waitForSelector(".hero");
}

async function quickAdd(page: Page, item: string) {
  await page.getByLabel("Quick add").hover();
  await page.getByRole("menuitem", { name: item }).click();
}

async function pick(
  page: Page,
  fieldId: string,
  text: string,
  option?: string | RegExp,
) {
  await page.locator(`#${fieldId}`).fill(text);
  await page
    .getByRole("option", { name: option ?? text })
    .first()
    .click();
}

test("flow 1: add a paper by DOI, link two proteins via findings, see them across pages without reload", async ({
  page,
}) => {
  const n = Date.now() % 1000000;
  const surname = `Tester${n}`;
  const protein = `E2E Protein ${n}`;
  // Crossref is not reachable from tests, so the lookup endpoint is mocked at the network edge.
  await page.route("**/api/v1/papers/lookup-doi/", (route) =>
    route.fulfill({
      json: {
        found: true,
        duplicate: null,
        fields: {
          title: "Mocked plasma TNF paper",
          authors: `M. ${surname} et al.`,
          first_author_surname: surname,
          year: 2025,
          journal: "Test Journal",
          doi: `10.1000/e2e-${n}`,
          ieee_reference: `M. ${surname} et al., “Mocked plasma TNF paper,” Test Journal, 2025.`,
        },
      },
    }),
  );
  await login(page);
  await quickAdd(page, "Add paper");
  const dialog = page.getByRole("dialog", { name: "Add paper" });
  await dialog
    .getByLabel("Add by DOI")
    .fill("https://doi.org/10.1000/e2e-test");
  await dialog.getByRole("button", { name: "Look up" }).click();
  await expect(dialog.getByText("Filled in from Crossref")).toBeVisible();
  await expect(dialog.getByLabel("Title")).toHaveValue(
    "Mocked plasma TNF paper",
  );
  await dialog.getByLabel("Citation number").fill(String(n));
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  // Finding 1: existing protein (TNF-α, seeded)
  await quickAdd(page, "Add finding");
  const f1 = page.getByRole("dialog", { name: "Add finding" });
  await pick(page, "f-paper", surname, new RegExp(`${surname} 2025`));
  await pick(page, "f-protein", "TNF", /TNF-α/);
  await f1.getByLabel("Direction").selectOption("predictive");
  await f1.getByLabel("Effect").fill("AUC 0.72");
  await f1.getByRole("button", { name: "Save" }).click();
  await expect(f1).toBeHidden();

  // Finding 2: a protein created inline from the picker
  await quickAdd(page, "Add finding");
  const f2 = page.getByRole("dialog", { name: "Add finding" });
  await pick(page, "f-paper", surname, new RegExp(`${surname} 2025`));
  await page.locator("#f-protein").fill(protein);
  await page.getByRole("option", { name: /Create/ }).click();
  await f2.getByLabel("Direction").selectOption("raised");
  await f2.getByRole("button", { name: "Save" }).click();
  await expect(f2).toBeHidden();

  // Navigate with in-app links only (no reload): data must already be fresh.
  await page.getByRole("link", { name: "Papers", exact: true }).first().click();
  await expect(
    page.getByRole("link", { name: `${surname} 2025` }),
  ).toBeVisible();
  await page.getByRole("link", { name: `${surname} 2025` }).click();
  await expect(
    page.getByRole("row", { name: /TNF-α.*Predictive.*AUC 0.72/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: new RegExp(`${protein}.*Raised`) }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Proteins", exact: true })
    .first()
    .click();
  await page.getByRole("link", { name: protein }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(`${surname} 2025.*Raised`) }),
  ).toBeVisible();
});

test("flow 2: edit a docs page in place, save, view history, restore the previous version", async ({
  page,
}) => {
  await login(page);
  // A page of its own, so repeated runs always start from exactly one version.
  const slug = `e2e-doc-${Date.now()}`;
  await page.evaluate(
    async ({ slug }) => {
      const csrf = decodeURIComponent(
        document.cookie
          .split("; ")
          .find((c) => c.startsWith("csrftoken="))!
          .split("=")[1],
      );
      const cats = await fetch("/api/v1/doc-categories/").then((r) => r.json());
      const res = await fetch("/api/v1/doc-pages/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
        body: JSON.stringify({
          title: "E2E page",
          slug,
          category: cats.results[0].id,
          body: "## Original heading\n\nOriginal text.",
        }),
      });
      if (!res.ok) throw new Error("setup failed " + res.status);
    },
    { slug },
  );
  await page.goto(`/docs/${slug}`);
  await expect(page.locator("article")).toContainText("Original text.");
  await page.getByRole("button", { name: "Turn edit mode on" }).click();
  await page.getByRole("button", { name: "Edit content" }).click();

  const editor = page.locator(".bn-editor");
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("E2E added paragraph.");
  await expect(page.getByText(/Saved · /)).toBeVisible({ timeout: 10000 }); // autosaved draft
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.locator("article")).toContainText("E2E added paragraph.");
  const data = await page.evaluate(
    (slug) => fetch(`/api/v1/doc-pages/?slug=${slug}`).then((r) => r.json()),
    slug,
  );
  expect(data.results[0].draft_body).toBe(""); // draft cleared once published

  await page.getByRole("button", { name: /History of E2E page/ }).click();
  const history = page.getByRole("dialog", { name: /History/ });
  const versions = history
    .getByRole("list", { name: "Versions" })
    .getByRole("button");
  await expect(versions).toHaveCount(2); // autosaves did not add versions
  await expect(history.getByText("E2E added paragraph.").first()).toBeVisible(); // diff shows the addition
  await versions.nth(1).click();
  await history.getByRole("button", { name: "Restore this version" }).click();
  await page
    .getByRole("dialog", { name: "Please confirm" })
    .getByRole("button", { name: "Restore" })
    .click();

  await expect(page.locator("article")).toContainText("Original text.");
  await expect(page.locator("article")).not.toContainText(
    "E2E added paragraph.",
  );
});

test("delete moves to Trash and restore brings it back", async ({ page }) => {
  await login(page);
  await page.goto("/decisions");
  await page.getByRole("button", { name: "Turn edit mode on" }).click();
  const title = "No univariable significance screening";
  await page.getByRole("button", { name: `Delete ${title}` }).click();
  await page
    .getByRole("dialog", { name: "Please confirm" })
    .getByRole("button", { name: "Move to Trash" })
    .click();
  await expect(page.getByRole("heading", { name: title })).toBeHidden();
  await page.goto("/trash");
  await page
    .getByRole("row", { name: new RegExp(title) })
    .getByRole("button", { name: "Restore" })
    .click();
  await page.goto("/decisions");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("pipeline stage reorder with buttons persists", async ({ page }) => {
  await login(page);
  await page.goto("/pipeline");
  await page.getByRole("button", { name: "Turn edit mode on" }).click();
  const first = page.locator(".stage").first();
  await expect(first).toContainText("Data access");
  await page.getByRole("button", { name: "Move Data access down" }).click();
  await expect(page.locator(".stage").first()).toContainText(
    "Cohort definition",
  );
  await page.reload();
  await expect(page.locator(".stage").first()).toContainText(
    "Cohort definition",
  );
  await page.getByRole("button", { name: "Move Data access up" }).click();
  await expect(page.locator(".stage").first()).toContainText("Data access");
});
