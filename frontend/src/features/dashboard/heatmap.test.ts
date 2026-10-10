import { describe, expect, it } from "vitest";
import { buildGrid, ringFraction } from "./heatmap";

describe("buildGrid", () => {
  const today = "2026-03-11"; // a Wednesday
  it("ends on today's weekday and spans the requested weeks", () => {
    const { days } = buildGrid([], today, 4);
    const last = days[days.length - 1];
    expect(last.date).toBe(today);
    expect(last.row).toBe(2); // Monday=0, so Wednesday=2
    expect(last.col).toBe(3);
    expect(days.filter((d) => d.col === 0)).toHaveLength(7); // full first week
    expect(days).toHaveLength(3 * 7 + 3); // 3 full weeks + Mon..Wed
  });
  it("never goes past today", () => {
    expect(buildGrid([], today, 2).days.every((d) => d.date <= today)).toBe(
      true,
    );
  });
  it("scales levels to the busiest day and keeps zero at level 0", () => {
    const { days } = buildGrid(
      [
        { date: "2026-03-10", count: 8 },
        { date: "2026-03-09", count: 1 },
        { date: "2026-03-05", count: 4 },
      ],
      today,
      2,
    );
    const lvl = (d: string) => days.find((x) => x.date === d)!.level;
    expect(lvl("2026-03-10")).toBe(4);
    expect(lvl("2026-03-05")).toBe(2);
    expect(lvl("2026-03-09")).toBe(1);
    expect(lvl("2026-03-08")).toBe(0);
  });
  it("labels the first week of each month", () => {
    const { months } = buildGrid([], today, 8);
    expect(months.map((m) => m.label)).toContain("Mar");
    expect(new Set(months.map((m) => m.label)).size).toBe(months.length);
  });
});

describe("ringFraction", () => {
  it("caps at a full ring and handles no goal", () => {
    expect(ringFraction(1, 4)).toBe(0.25);
    expect(ringFraction(6, 4)).toBe(1);
    expect(ringFraction(2, 0)).toBe(0);
  });
});
