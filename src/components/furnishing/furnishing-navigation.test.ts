import { describe, expect, it } from "vitest";
import { furnishingNavigationItems, furnishingSectionForPath } from "./furnishing-navigation";

describe("Furnishing Studio navigation contract", () => {
  it("keeps the canonical areas in product order", () => {
    expect(furnishingNavigationItems.map((item) => item.label)).toEqual([
      "Overview", "Product Catalog", "Imports", "Room Packages", "Design Workspaces",
      "Budgets", "Procurement", "Installations", "Release Controls", "Settings",
    ]);
  });

  it.each([
    ["/admin/furnishing", "overview"],
    ["/admin/furnishing/imports/104", "imports"],
    ["/admin/furnishing/products/import/104", "imports"],
    ["/admin/furnishing/room-packages/abc", "room-packages"],
    ["/admin/furnishing/packages/rooms/abc", "room-packages"],
    ["/admin/furnishing/projects/abc/procurement", "workspaces"],
    ["/admin/furnishing/procurement/order-123", "procurement"],
    ["/admin/furnishing/activation", "release-controls"],
  ] as const)("maps %s to one active parent", (pathname, expected) => {
    expect(furnishingSectionForPath(pathname)).toBe(expected);
  });

  it("uses stable canonical links", () => {
    expect(furnishingNavigationItems.map((item) => item.href)).toEqual([
      "/admin/furnishing", "/admin/furnishing/catalog", "/admin/furnishing/imports",
      "/admin/furnishing/room-packages", "/admin/furnishing/workspaces", "/admin/furnishing/budgets",
      "/admin/furnishing/procurement", "/admin/furnishing/installations",
      "/admin/furnishing/release-controls", "/admin/furnishing/settings",
    ]);
  });
});
