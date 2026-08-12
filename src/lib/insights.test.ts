import { describe, expect, it } from "vitest";
import { findInsightArticle, insightArticles, insightsCards } from "./insights";
import { readFileSync } from "node:fs";

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

  it("keeps every authored article link and image on a registered local route", () => {
    const sources = insightArticles.map((article) =>
      readFileSync(`content/insights/${article.slug}.mdx`, "utf8"),
    );
    const references = sources
      .flatMap((source) => [...source.matchAll(/!?\[[^\]]*\]\((\/[^)]+)\)/g)])
      .map((match) => match[1]);
    expect(references.length).toBeGreaterThan(20);
    for (const reference of references) {
      if (reference.startsWith("/images/"))
        expect(() => readFileSync(`public${reference}`)).not.toThrow();
      if (reference.startsWith("/resources/insights/"))
        expect(findInsightArticle(reference.split("/").at(-1)!)).toBeTruthy();
    }
  });
});
