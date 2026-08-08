import { describe, expect, it } from "vitest";
import {
  designReview,
  inheritedRoomDirection,
  orderProductsForStyle,
  styleCoverage,
} from "./design";
describe("FS-004 design intelligence", () => {
  it("orders explainable compatibility before unclassified products", () =>
    expect(
      orderProductsForStyle([
        { name: "B", compatibility: null },
        { name: "A", compatibility: "preferred" },
        { name: "C", compatibility: "avoid" },
      ]).map((x) => x.name),
    ).toEqual(["A", "C", "B"]));
  it("inherits property direction unless a room overrides it", () => {
    const profile = {
      moodTags: ["warm"],
      contextualTags: ["desert"],
      tokenIds: ["oak"],
    };
    expect(inheritedRoomDirection(profile, null).inherited).toBe(true);
    expect(
      inheritedRoomDirection(profile, {
        moodTags: ["serene"],
        accentTokenIds: ["sage"],
      }).moodTags,
    ).toEqual(["serene"]);
  });
  it("reports review issues without inventing a score", () =>
    expect(
      designReview({
        assignments: [{ compatibility: "avoid" }, { compatibility: null }],
        rooms: [{ hasDirection: false }],
        accentTokenCount: 0,
      }),
    ).toEqual([
      "1 products classified Avoid",
      "1 products unclassified",
      "1 rooms have no design direction",
      "No accent token selected",
    ]));
  it("keeps unclassified distinct from neutral", () =>
    expect(styleCoverage([{ compatibility: "neutral" }], 3)).toEqual({
      preferred: 0,
      compatible: 0,
      neutral: 1,
      avoid: 0,
      unclassified: 2,
    }));
});
