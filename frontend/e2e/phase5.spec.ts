import { test } from "@playwright/test";
import { apiCall, expect, login, uid } from "./helpers";

async function setup(page: import("@playwright/test").Page) {
  const n = uid();
  const a = await apiCall(page, "POST", "/papers/", {
    title: `Matrix paper A ${n}`,
    first_author_surname: `Mxa${n}`,
    year: 2023,
    population: "general_population",
    design: "prediction",
    sample_size: 4000,
    citation_number: Number(n.slice(-6)),
  });
  const b = await apiCall(page, "POST", "/papers/", {
    title: `Matrix paper B ${n}`,
    first_author_surname: `Mxb${n}`,
    year: 2021,
    population: "genetic_ftd",
    design: "cross_sectional",
    sample_size: 60,
  });
  const p1 = await apiCall(page, "POST", "/proteins/", {
    name: `MxProt1-${n}`,
  });
  const p2 = await apiCall(page, "POST", "/proteins/", {
    name: `MxProt2-${n}`,
  });
  const f = (paper: number, protein: number, direction: string, extra = {}) =>
    apiCall(page, "POST", "/findings/", {
      paper,
      protein,
      direction,
      ...extra,
    });
  await f(a.id, p1.id, "predictive", {
    effect: "AUC 0.72",
    context_detail: "incident FTD",
  });
  await f(b.id, p1.id, "raised", { effect: "d = 0.6" });
  await f(a.id, p2.id, "lowered");
  return { n, a, b, p1, p2 };
}

test("flow 4: drag a pipeline step to Done and the progress bar updates", async ({
  page,
}) => {
  await login(page);
  await page.goto("/pipeline");
  const bar = page.getByRole("img", { name: /Pipeline \d+% done/ });
  await expect(bar).toBeVisible();
  const before = Number(
    (await bar.getAttribute("aria-label"))!.match(/(\d+)% done/)![1],
  );
  const done = page.getByRole("group", { name: /^Done,/ });
  await page
    .locator(".board__card", { hasText: "Cohort definition" })
    .first()
    .dragTo(done);
  await expect(done.getByText("Cohort definition")).toBeVisible();
  await expect
    .poll(async () =>
      Number((await bar.getAttribute("aria-label"))!.match(/(\d+)% done/)![1]),
    )
    .toBeGreaterThan(before);

  // keyboard-friendly alternative: the Move-to menu, and Blocked asks why
  await page.getByLabel("Move Event audit to").selectOption("blocked");
  await page.getByLabel("What is blocking it?").fill("waiting for data access");
  await page.getByRole("button", { name: "Mark as blocked" }).click();
  await expect(
    page
      .getByRole("group", { name: /^Blocked,/ })
      .getByText("Blocked: waiting for data access"),
  ).toBeVisible();
  const saved = await apiCall(
    page,
    "GET",
    "/pipeline-stages/?search=Event%20audit",
  );
  expect(saved.results[0].status).toBe("blocked");
  expect(saved.results[0].blocked_reason).toBe("waiting for data access");

  // timeline view
  await page.getByRole("button", { name: "Timeline" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Cohort definition" }),
  ).toBeVisible();
});

test("evidence matrix: symbols, tooltip, keyboard, filters, table view", async ({
  page,
}) => {
  await login(page);
  const { n, p1 } = await setup(page);
  await page.goto("/visualise/evidence-matrix");
  const row = page.getByRole("link", { name: `MxProt1-${n}` });
  await expect(row).toBeVisible();
  const cells = page.getByRole("button", {
    name: new RegExp(`MxProt1-${n}, Mxa${n}`),
  });
  await expect(cells).toBeVisible();
  await expect(cells).toHaveAccessibleName(/Predictive/);

  await cells.hover();
  await expect(page.getByRole("tooltip")).toContainText("AUC 0.72");
  await page.mouse.move(0, 0);

  // keyboard: arrow to the neighbouring cell in the same row, Enter opens its detail
  await cells.focus();
  await page.keyboard.press("ArrowRight");
  const next = page.getByRole("button", {
    name: new RegExp(`MxProt1-${n}, Mxb${n}`),
  });
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("region", { name: "Selected finding" });
  await expect(detail).toContainText("Raised");
  await expect(detail).toContainText("d = 0.6");

  // filter: only general-population papers
  await page
    .locator(".viz-filters label")
    .filter({ hasText: /^Population/ })
    .locator("select")
    .selectOption("general_population");
  await expect(page).toHaveURL(/population=general_population/);
  await expect(
    page.getByRole("button", { name: new RegExp(`Mxb${n}`) }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: new RegExp(`Mxa${n}`) }).first(),
  ).toBeVisible();

  // the same data is available as a table
  await page.getByText("View as a table").click();
  await expect(
    page.getByRole("row", {
      name: new RegExp(`MxProt1-${n}.*Predictive.*AUC 0.72`),
    }),
  ).toBeVisible();
  expect(p1.slug).toBeTruthy();
});

test("every chart exports as SVG and PNG, with colours resolved", async ({
  page,
}) => {
  await login(page);
  await setup(page);
  await page.goto("/visualise/evidence-matrix");
  await expect(page.locator("svg[data-export]")).toBeVisible();
  const svgDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  const svg = await svgDownload;
  expect(svg.suggestedFilename()).toBe("evidence-matrix.svg");
  const text = await (
    await import("node:fs")
  ).promises.readFile((await svg.path())!, "utf8");
  expect(text.startsWith("<svg")).toBe(true);
  expect(text).not.toContain("var(--"); // theme variables are baked in so it looks right elsewhere
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const png = await pngDownload;
  expect(png.suggestedFilename()).toBe("evidence-matrix.png");
  const size = (
    await (await import("node:fs")).promises.stat((await png.path())!)
  ).size;
  expect(size).toBeGreaterThan(1500);
});

test("gap map flags the gap this project fills and counts findings for one protein", async ({
  page,
}) => {
  await login(page);
  const { n, p2 } = await setup(page);
  await page.goto("/visualise/gap-map");
  const target = page.getByRole("button", {
    name: /General population, Prediction of incident disease: \d+ paper/,
  });
  await expect(target).toBeVisible();
  await expect(target).toHaveAccessibleName(/This project/);
  await expect(page.getByText("This project", { exact: true })).toBeVisible();
  await target.click();
  await expect(
    page.getByRole("region", { name: "Papers in this cell" }),
  ).toContainText(`Mxa${n}`);

  // pick a protein: counts become findings for it, and other cells are gaps
  await page.getByLabel("Count").selectOption(p2.slug);
  await expect(
    page.getByRole("button", { name: /Sporadic FTD, Cross-sectional: a gap/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /General population, Prediction of incident disease: 1 findings/,
    }),
  ).toBeVisible();
});

test("evidence chain: assess a paper and see the 'no paper meets all five' summary", async ({
  page,
}) => {
  await login(page);
  const { n } = await setup(page);
  await page.goto("/visualise/evidence-chain");
  await expect(
    page.getByText("No paper meets all five requirements yet."),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: new RegExp(`Mxa${n}.*requirement 1: Not assessed`),
    })
    .click();
  const dlg = page.getByRole("dialog");
  await dlg
    .getByLabel("Does the paper meet this requirement?")
    .selectOption("yes");
  await dlg
    .getByLabel("Why")
    .fill("Plasma proteins were measured in cases and controls.");
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("button", {
      name: new RegExp(`Mxa${n}.*requirement 1: Yes`),
    }),
  ).toBeVisible();
  const all = await apiCall(page, "GET", "/requirement-assessments/");
  expect(
    all.results.some((a: { justification: string }) =>
      a.justification.includes("Plasma proteins"),
    ),
  ).toBe(true);
});

test("a chart can be embedded in a doc with filters, and bad names are explained", async ({
  page,
}) => {
  await login(page);
  const { n } = await setup(page);
  const cats = await apiCall(page, "GET", "/doc-categories/");
  const slug = `embed-${n}`;
  await apiCall(page, "POST", "/doc-pages/", {
    title: "Embed test",
    slug,
    category: cats.results[0].id,
    body: "Before.\n\n{{viz:evidence-matrix population=general_population}}\n\n{{viz:gap-map}}\n\n{{viz:not-a-chart}}\n",
  });
  await page.goto(`/docs/${slug}`);
  await expect(
    page.getByRole("region", { name: "Evidence matrix" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Gap map" })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Evidence matrix" })
      .getByRole("button", { name: new RegExp(`Mxa${n}`) })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Evidence matrix" })
      .getByRole("button", { name: new RegExp(`Mxb${n}`) }),
  ).toHaveCount(0); // filter applied
  await expect(
    page.getByText("Unknown visualisation “not-a-chart”"),
  ).toBeVisible();
});

test("results panel: primary comparison says whether the interval excludes zero", async ({
  page,
}) => {
  await login(page);
  const make = (
    title: string,
    date: string,
    lo: string,
    hi: string,
    v: string,
  ) =>
    apiCall(page, "POST", "/results/", {
      title,
      date,
      model_label: "M3",
      metric: "delta_auc",
      value: v,
      ci_lower: lo,
      ci_upper: hi,
      horizon_years: "10",
      n_events: 50,
      n_participants: 5000,
    });
  // dates later than any result already in the (reused) database, so these are the newest
  const existing = await apiCall(page, "GET", "/results/?page_size=200");
  const last = Math.max(
    0,
    ...existing.results.map(
      (r: { date: string }) => Date.parse(r.date) / 864e5,
    ),
  );
  const at = (k: number) =>
    new Date((last + k * 2) * 864e5).toISOString().slice(0, 10);
  await make(`Earlier ${uid()}`, at(1), "-0.01", "0.03", "0.012");
  await make(`Later ${uid()}`, at(2), "0.004", "0.04", "0.021");
  await page.goto("/visualise/results");
  const primary = page.getByRole("region", { name: "Primary comparison" });
  await expect(primary).toContainText("+0.021");
  await expect(primary).toContainText("The interval excludes zero");
  await expect(page.getByText("Data policy:")).toBeVisible();
  await expect(page.locator("svg[data-export]")).toBeVisible();
  await make(`Newest ${uid()}`, at(3), "-0.005", "0.02", "0.007");
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Primary comparison" }),
  ).toContainText("The interval includes zero");
});

test("network: nodes, focus on click, search, and a table alternative", async ({
  page,
}) => {
  await login(page);
  const { n } = await setup(page);
  await page.goto("/visualise/network?population=general_population");
  await expect(
    page.locator("svg[data-export] [data-node]").first(),
  ).toBeVisible();
  await page.getByLabel("Find a node").fill(`MxProt1-${n}`);
  await expect(
    page.locator(
      "svg[data-export] [data-node] circle[stroke='var(--ifm-color-primary)']",
    ),
  ).toHaveCount(1);
  const node = page
    .locator("svg[data-export] [data-node]", { has: page.locator("circle") })
    .filter({ hasText: `MxProt1-${n}` });
  // wait for the force layout to stop moving before clicking
  let last = "";
  await expect
    .poll(async () => {
      const b = JSON.stringify(await node.boundingBox());
      const settled = b === last;
      last = b;
      return settled;
    })
    .toBe(true);
  await node.click({ force: true });
  await expect(page.getByText(/Focused on/)).toBeVisible();
  await page.getByText("View as a table").click();
  await expect(
    page.getByRole("row", {
      name: new RegExp(`mxprot1-${n}.*Predictive`, "i"),
    }),
  ).toBeVisible();
});

test("timeline: papers by year and size, clickable", async ({ page }) => {
  await login(page);
  const { n } = await setup(page);
  await page.goto("/visualise/timeline");
  const dot = page.getByRole("link", {
    name: new RegExp(
      `Mxa${n} 2023, 2023, n 4000, Prediction, General population`,
    ),
  });
  await expect(dot).toBeVisible();
  await dot.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/papers/mxa${n}`, "i"));
});

test("dashboard: weekly goal ring, streak, next actions and milestones", async ({
  page,
}) => {
  await login(page);
  await page.goto("/settings");
  await page.locator("#s-weekly_reading_goal").fill("4");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();

  const n = uid();
  const p = await apiCall(page, "POST", "/papers/", {
    title: `Goal paper ${n}`,
    first_author_surname: `Goal${n}`,
    year: 2025,
    relevance: "core",
    reading_status: "to_read",
  });
  await page.goto("/");
  const section = page.getByRole("region", { name: "Your progress" });
  await expect(section).toBeVisible();
  await expect(
    section.getByRole("img", { name: /of 4 papers finished this week/ }),
  ).toBeVisible();
  const before = Number(
    (await section
      .getByRole("img", { name: /papers finished this week/ })
      .getAttribute("aria-label"))!.match(/^(\d+) of/)![1],
  );
  await expect(
    section.getByRole("link", { name: /core papers? still to read/ }),
  ).toBeVisible();
  await expect(
    section.getByText("days in a row").or(section.getByText("day in a row")),
  ).toBeVisible();
  await expect(
    section.getByRole("img", { name: /Activity over the last 26 weeks/ }),
  ).toBeVisible();
  await expect(
    section.getByRole("heading", { name: /Milestones/ }),
  ).toBeVisible();

  // finishing the paper moves the ring
  await apiCall(page, "PATCH", `/papers/${p.id}/`, { reading_status: "read" });
  await page.reload();
  const after = Number(
    (await page
      .getByRole("region", { name: "Your progress" })
      .getByRole("img", { name: /papers finished this week/ })
      .getAttribute("aria-label"))!.match(/^(\d+) of/)![1],
  );
  expect(after).toBe(before + 1);
});
