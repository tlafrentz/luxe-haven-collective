import { describe, expect, it } from "vitest";
import { furnishingNavigationItems, furnishingSectionForPath } from "./furnishing-navigation";

describe("Furnishing Studio navigation contract (FS-UX-010)", () => {
  it("uses the simplified six-section horizontal menu", () => {
    expect(furnishingNavigationItems.map((item) => item.label)).toEqual([
      "Overview", "Product Library", "Room Packages", "Furnishing Plans", "Procurement", "Installations",
    ]);
  });

  it("uses stable canonical links", () => {
    expect(furnishingNavigationItems.map((item) => item.href)).toEqual([
      "/admin/furnishing", "/admin/furnishing/products", "/admin/furnishing/room-packages",
      "/admin/furnishing/workspaces", "/admin/furnishing/procurement", "/admin/furnishing/installations",
    ]);
  });

  it("drops Imports and Release Controls from primary navigation", () => {
    const ids = furnishingNavigationItems.map((item) => item.id);
    expect(ids).not.toContain("imports");
    expect(ids).not.toContain("release-controls");
    expect(ids).not.toContain("settings");
  });

  it.each([
    ["/admin/furnishing", "overview"],
    ["/admin/furnishing/products", "product-library"],
    ["/admin/furnishing/products/104", "product-library"],
    ["/admin/furnishing/products/import/104", "product-library"],
    ["/admin/furnishing/catalog/104", "product-library"],
    ["/admin/furnishing/imports/new", "product-library"],
    ["/admin/furnishing/retailers", "product-library"],
    ["/admin/furnishing/room-packages/abc", "room-packages"],
    ["/admin/furnishing/packages/rooms/abc", "room-packages"],
    ["/admin/furnishing/workspaces/abc", "furnishing-plans"],
    ["/admin/furnishing/projects/abc/procurement", "furnishing-plans"],
    ["/admin/furnishing/budgets/abc", "furnishing-plans"],
    ["/admin/furnishing/procurement/order-123", "procurement"],
    ["/admin/furnishing/installations/abc", "installations"],
    ["/admin/furnishing/installation", "installations"],
  ] as const)("maps %s to one active parent", (pathname, expected) => {
    expect(furnishingSectionForPath(pathname)).toBe(expected);
  });
});
