import { describe, expect, it } from "vitest";
import { resolveLink, splitWikilink, type LinkItem } from "./data";

const index: LinkItem[] = [
  { type: "docs", title: "Cohort definition", url: "/docs/c", context: "x" },
  {
    type: "proteins",
    title: "NfL",
    url: "/proteins/nfl",
    context: "y",
    aliases: ["Neurofilament light"],
  },
];

describe("resolveLink", () => {
  it("matches titles ignoring case and spacing", () => {
    expect(resolveLink(index, "  cohort   DEFINITION ")?.url).toBe("/docs/c");
  });
  it("matches aliases", () => {
    expect(resolveLink(index, "neurofilament light")?.url).toBe(
      "/proteins/nfl",
    );
  });
  it("returns nothing for unknown targets or before the index loads", () => {
    expect(resolveLink(index, "Nope")).toBeUndefined();
    expect(resolveLink(undefined, "NfL")).toBeUndefined();
  });
});

describe("splitWikilink", () => {
  it("splits an optional label", () => {
    expect(splitWikilink("NfL|the marker")).toEqual({
      target: "NfL",
      label: "the marker",
    });
    expect(splitWikilink(" NfL ")).toEqual({ target: "NfL", label: "NfL" });
    expect(splitWikilink("NfL|")).toEqual({ target: "NfL", label: "NfL" });
  });
});
