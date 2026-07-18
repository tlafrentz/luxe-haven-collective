import { describe, expect, it } from "vitest";
import { SimilarityScore } from "../value-objects/similarity-score";

describe("SimilarityScore", () => {
  it("normalizes and classifies the score", () => {
    const score = new SimilarityScore(82.5);
    expect(score.normalized).toBe(0.825);
    expect(score.isStrong).toBe(true);
  });

  it("accepts a valid 100-point breakdown", () => {
    const score = new SimilarityScore(91, { distance: 25, squareFeet: 20, bedrooms: 20, bathrooms: 15, yearBuilt: 5, propertyType: 15 });
    expect(score.breakdown?.distance).toBe(25);
  });

  it("rejects an invalid breakdown total", () => {
    expect(() => new SimilarityScore(75, { distance: 20, squareFeet: 20, bedrooms: 20, bathrooms: 15, yearBuilt: 5, propertyType: 10 })).toThrow("Similarity score breakdown must total 100.");
  });
});
