/** Read/write a set of string filters in the URL query. */
export function readParams(
  sp: URLSearchParams,
  names: string[],
): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n, sp.get(n) ?? ""]));
}
export function withParam(
  sp: URLSearchParams,
  name: string,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(sp);
  if (value) next.set(name, value);
  else next.delete(name);
  return next;
}
export function sortBy<T>(
  items: T[],
  get: (t: T) => string | number | null | undefined,
  dir: 1 | -1 = 1,
): T[] {
  return [...items].sort((a, b) => {
    const x = get(a),
      y = get(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1; // missing values always last
    if (y == null) return -1;
    return (
      (typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y))) * dir
    );
  });
}
