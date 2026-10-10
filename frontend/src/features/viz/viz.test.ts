import { describe, expect, it } from "vitest";
import { neighbour } from "./EvidenceMatrix";
import { parseEmbed, queryOf } from "./VizByName";
import { DIRECTIONS, DIRECTION_ORDER } from "./direction";

describe("matrix keyboard navigation", () => {
  const cells = [
    { r: 0, c: 0, key: "0:0" },
    { r: 0, c: 3, key: "0:3" },
    { r: 2, c: 1, key: "2:1" },
    { r: 2, c: 4, key: "2:4" },
  ];
  it("moves to the next cell along a row, and stops at the end", () => {
    expect(neighbour(cells, cells[0], "ArrowRight")).toBe("0:3");
    expect(neighbour(cells, cells[1], "ArrowRight")).toBeNull();
    expect(neighbour(cells, cells[1], "ArrowLeft")).toBe("0:0");
  });
  it("moves between rows to the closest column", () => {
    expect(neighbour(cells, cells[0], "ArrowDown")).toBe("2:1");
    expect(neighbour(cells, cells[1], "ArrowDown")).toBe("2:4");
    expect(neighbour(cells, cells[2], "ArrowUp")).toBe("0:0");
    expect(neighbour(cells, cells[2], "ArrowDown")).toBeNull();
  });
});

describe("embed shortcodes", () => {
  it("parses a name and filters", () => {
    expect(
      parseEmbed(
        "evidence-matrix population=general_population design=prediction",
      ),
    ).toEqual({
      name: "evidence-matrix",
      params: { population: "general_population", design: "prediction" },
    });
    expect(parseEmbed("network")).toEqual({ name: "network", params: {} });
  });
  it("keeps only known filters in the query", () => {
    expect(
      queryOf({
        population: "genetic_ftd",
        evil: "1",
        fluid: "csf",
        design: "",
      }),
    ).toBe("population=genetic_ftd&fluid=csf");
  });
});

describe("direction encoding", () => {
  it("gives every kind of finding its own shape or fill, so colour is never the only cue", () => {
    const seen = new Set(
      DIRECTION_ORDER.map(
        (k) => `${DIRECTIONS[k].shape}:${DIRECTIONS[k].filled}`,
      ),
    );
    expect(seen.size).toBe(DIRECTION_ORDER.length);
  });
  it("uses at most three hues (the all-pairs-safe cap) plus neutrals", () => {
    const hues = new Set(
      DIRECTION_ORDER.map((k) => DIRECTIONS[k].colour).filter(
        (c) => !/neutral|assoc/.test(c),
      ),
    );
    expect(hues.size).toBeLessThanOrEqual(3);
  });
});
