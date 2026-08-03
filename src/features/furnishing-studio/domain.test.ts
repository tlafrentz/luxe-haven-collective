import { describe, expect, it } from "vitest";
import {
  canCompleteProject,
  projectProgress,
  sanitizeAffiliateUrl,
  snapshotPackage,
  totalBudget,
} from "./domain";
describe("furnishing studio domain", () => {
  it("keeps package snapshots independent", () => {
    const source = { name: "Modern", items: [{ name: "Sofa" }] },
      snapshot = snapshotPackage(source);
    source.items[0].name = "Changed";
    expect(snapshot.items[0].name).toBe("Sofa");
  });
  it("keeps phase distinct and derives progress", () => {
    expect(projectProgress("procurement")).toBe(65);
    expect(projectProgress("complete")).toBe(100);
  });
  it("blocks completion with open punch work", () => {
    expect(
      canCompleteProject({ openPunchItems: 1, exceptionAuthorized: false }),
    ).toBe(false);
    expect(
      canCompleteProject({ openPunchItems: 1, exceptionAuthorized: true }),
    ).toBe(true);
  });
  it("totals explicit budget states", () =>
    expect(totalBudget({ target: 10000, contingency: 1000, labor: 500 })).toBe(
      11500,
    ));
  it("removes tracking parameters from displayed affiliate urls", () =>
    expect(
      sanitizeAffiliateUrl(
        "https://example.com/sofa?utm_source=x&sku=1&ref=abc",
      ),
    ).toBe("https://example.com/sofa?sku=1"));
});
