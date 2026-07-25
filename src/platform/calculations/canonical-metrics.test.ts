import { describe, expect, it } from "vitest";
import {
  canonicalAdr,
  canonicalComparison,
  canonicalOccupancy,
  canonicalOverlappingNights,
  canonicalRevPar,
} from "./canonical-metrics";

describe("canonical portfolio calculations", () => {
  it("caps occupancy at 100 percent", () => {
    expect(canonicalOccupancy(65, 30)).toBe(1);
  });

  it("counts only nights inside the reporting period", () => {
    expect(canonicalOverlappingNights("2026-06-29", "2026-08-31", "2026-06-01", "2026-07-01")).toBe(2);
  });

  it("uses weighted ADR and RevPAR inputs", () => {
    expect(canonicalAdr(600, 3)).toBe(200);
    expect(canonicalRevPar(600, 6)).toBe(100);
  });

  it("does not fabricate zero-baseline or near-zero percentage changes", () => {
    expect(canonicalComparison(0, 0)).toMatchObject({ status: "available", percentage: 0 });
    expect(canonicalComparison(100, 0).status).toBe("new-measurement");
    expect(canonicalComparison(100, 0.001).status).toBe("unavailable");
    expect(canonicalComparison(120, 100)).toMatchObject({ status: "available", percentage: 20 });
  });
});
