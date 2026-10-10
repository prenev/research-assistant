export interface Day {
  date: string; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  col: number; // week column
  row: number; // 0 = Monday
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Activity as a weeks-by-weekday grid ending today, with 5 intensity levels relative to the busiest day. */
export function buildGrid(
  activity: { date: string; count: number }[],
  today: string,
  weeks = 26,
): { days: Day[]; months: { col: number; label: string }[] } {
  const counts = new Map(activity.map((a) => [a.date, a.count]));
  const end = new Date(today + "T00:00:00");
  const endRow = (end.getDay() + 6) % 7; // Monday = 0
  const start = new Date(end);
  start.setDate(end.getDate() - endRow - (weeks - 1) * 7);
  const max = Math.max(1, ...activity.map((a) => a.count));
  const days: Day[] = [];
  const months: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let col = 0; col < weeks; col++) {
    for (let row = 0; row < 7; row++) {
      const d = new Date(start);
      d.setDate(start.getDate() + col * 7 + row);
      if (d > end) continue;
      const key = iso(d);
      const count = counts.get(key) ?? 0;
      const level =
        count === 0
          ? 0
          : (Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as
              1 | 2 | 3 | 4);
      days.push({ date: key, count, level, col, row });
      if (row === 0 && d.getMonth() !== lastMonth) {
        lastMonth = d.getMonth();
        months.push({
          col,
          label: d.toLocaleDateString("en-GB", { month: "short" }),
        });
      }
    }
  }
  return { days, months };
}

/** Arc length for a progress ring, capped at a full circle. */
export const ringFraction = (done: number, goal: number) =>
  goal <= 0 ? 0 : Math.min(1, done / goal);
