export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API ${status}`);
  }
}

function cookie(name: string): string {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith(name + "="))
      ?.split("=")[1] ?? ""
  );
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (method !== "GET")
    headers.set("X-CSRFToken", decodeURIComponent(cookie("csrftoken")));
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const post = <T>(path: string, data?: unknown) =>
  api<T>(path, {
    method: "POST",
    body: data === undefined ? undefined : JSON.stringify(data),
  });
