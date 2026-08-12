import { describe, expect, it } from "vitest";
import { findInsightArticle, insightArticles, insightsCards } from "./insights";

describe("Luxe Haven Journal", () => {
  it("registers eight unique article routes with local hero images", () => {
    expect(insightArticles).toHaveLength(8);
    expect(new Set(insightArticles.map((article) => article.slug)).size).toBe(
      8,
    );
    expect(
      insightsCards.every(
        (card) =>
          card.href.startsWith("/resources/insights/") &&
          card.image.startsWith("/images/journal/"),
      ),
    ).toBe(true);
  });

  it("resolves known articles and rejects unknown slugs", () => {
    expect(
      findInsightArticle("dynamic-pricing-strategies-that-actually-work"),
    ).toMatchObject({ category: "Revenue", readingTimeMinutes: 7 });
    expect(findInsightArticle("unknown")).toBeUndefined();
  });
});
