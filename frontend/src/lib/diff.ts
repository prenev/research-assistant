export interface DiffLine {
  type: "same" | "del" | "add";
  text: string;
}

/** Line diff by longest common subsequence. Fine for page-sized text. */
export function diffLines(a: string, b: string): DiffLine[] {
  const x = a === "" ? [] : a.split("\n");
  const y = b === "" ? [] : b.split("\n");
  const n = x.length,
    m = y.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] =
        x[i] === y[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      out.push({ type: "same", text: x[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1])
      out.push({ type: "del", text: x[i++] });
    else out.push({ type: "add", text: y[j++] });
  }
  while (i < n) out.push({ type: "del", text: x[i++] });
  while (j < m) out.push({ type: "add", text: y[j++] });
  return out;
}

/** Split a diff into aligned left (old) and right (new) rows for side-by-side display. */
export function sideBySide(
  a: string,
  b: string,
): { left?: DiffLine; right?: DiffLine }[] {
  const rows: { left?: DiffLine; right?: DiffLine }[] = [];
  const diff = diffLines(a, b);
  for (let k = 0; k < diff.length;) {
    const d = diff[k];
    if (d.type === "same") {
      rows.push({ left: d, right: d });
      k++;
      continue;
    }
    const dels: DiffLine[] = [],
      adds: DiffLine[] = [];
    while (k < diff.length && diff[k].type !== "same")
      (diff[k].type === "del" ? dels : adds).push(diff[k++]);
    for (let r = 0; r < Math.max(dels.length, adds.length); r++)
      rows.push({ left: dels[r], right: adds[r] });
  }
  return rows;
}
