import { expect, type Page } from "@playwright/test";

const user = process.env.E2E_USER ?? "owner";
const password = process.env.E2E_PASSWORD ?? "pw-12345-long";

export async function login(page: Page) {
  await page.goto("/");
  await page.fill("#u", user);
  await page.fill("#p", password);
  await page.click("button[type=submit]");
  await page.waitForSelector(".hero");
}

/** Call the API from inside the logged-in page (so cookies and CSRF apply). */
export async function apiCall<T = any>(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const csrf = decodeURIComponent(
        document.cookie
          .split("; ")
          .find((c) => c.startsWith("csrftoken="))
          ?.split("=")[1] ?? "",
      );
      const res = await fetch(`/api/v1${path}`, {
        method,
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok)
        throw new Error(
          `${method} ${path} -> ${res.status} ${await res.text()}`,
        );
      return res.status === 204 ? null : res.json();
    },
    { method, path, body },
  );
}

export const uid = () =>
  String(Date.now() % 100000000) + Math.floor(Math.random() * 100);

export async function quickAdd(page: Page, item: string) {
  await page.getByLabel("Quick add").hover();
  await page.getByRole("menuitem", { name: item }).click();
}

export { expect };
