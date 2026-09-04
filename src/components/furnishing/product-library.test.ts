import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/furnishing-library", () => ({
  getFurnishingLibrary: vi.fn(),
  getLibraryImageBackfillStatus: vi.fn(),
}));

const { buildQuery } = await import("./product-library");

describe("buildQuery pagination", () => {
  it("carries an explicit cursor override into the URL (the 'Show more products' link)", () => {
    const href = buildQuery({ q: "lamp" }, { cursor: "abc123" });
    const url = new URL(href, "https://example.com");
    expect(url.searchParams.get("cursor")).toBe("abc123");
    expect(url.searchParams.get("q")).toBe("lamp");
  });

  it("drops any existing cursor when no override is given (changing search/filters resets pagination)", () => {
    const href = buildQuery({ q: "lamp", cursor: "abc123" }, { q: "sofa" });
    const url = new URL(href, "https://example.com");
    expect(url.searchParams.get("cursor")).toBeNull();
    expect(url.searchParams.get("q")).toBe("sofa");
  });
});
