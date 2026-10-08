import { describe, expect, it } from "vitest";
import { readParams, sortBy, withParam } from "./params";

describe("params", () => {
  it("reads and writes filters", () => {
    const sp = new URLSearchParams("design=prediction&x=1");
    expect(readParams(sp, ["design", "population"])).toEqual({
      design: "prediction",
      population: "",
    });
    expect(withParam(sp, "population", "genetic_ftd").toString()).toBe(
      "design=prediction&x=1&population=genetic_ftd",
    );
    expect(withParam(sp, "design", "").toString()).toBe("x=1");
  });
});

describe("sortBy", () => {
  const rows = [{ n: 2 }, { n: null }, { n: 1 }];
  it("sorts ascending and descending with missing values last", () => {
    expect(sortBy(rows, (r) => r.n).map((r) => r.n)).toEqual([1, 2, null]);
    expect(sortBy(rows, (r) => r.n, -1).map((r) => r.n)).toEqual([2, 1, null]);
  });
  it("sorts text", () => {
    expect(
      sortBy([{ s: "b" }, { s: "a" }], (r) => r.s).map((r) => r.s),
    ).toEqual(["a", "b"]);
  });
});
