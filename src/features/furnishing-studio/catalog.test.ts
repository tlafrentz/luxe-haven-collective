import { describe, expect, it } from "vitest";
import {
  canonicalizeRetailerUrl,
  catalogAttention,
  minorUnits,
  offerFreshness,
  probableProductDuplicate,
  representativeOffer,
  requiredPurchases,
  type CatalogOffer,
} from "./catalog";

const offer = (overrides: Partial<CatalogOffer> = {}): CatalogOffer => ({
  id: "offer",
  status: "active",
  availability: "in_stock",
  listedPrice: { amountMinor: 16200, currency: "USD" },
  lastVerifiedAt: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

describe("FS-002 catalog policies", () => {
  it("uses an eligible preferred offer before the lowest in-stock offer", () => {
    expect(
      representativeOffer([
        offer({
          id: "low",
          listedPrice: { amountMinor: 15464, currency: "USD" },
        }),
        offer({ id: "preferred", preferred: true }),
      ])?.id,
    ).toBe("preferred");
    expect(
      representativeOffer([
        offer({ id: "high" }),
        offer({
          id: "low",
          listedPrice: { amountMinor: 15464, currency: "USD" },
        }),
      ])?.id,
    ).toBe("low");
  });
  it("never treats unavailable or unpriced offers as a representative price", () => {
    expect(
      representativeOffer([
        offer({ availability: "out_of_stock" }),
        offer({ listedPrice: null }),
      ]),
    ).toBeNull();
  });
  it("classifies freshness deterministically", () => {
    const now = new Date("2026-08-07T00:00:00Z");
    expect(offerFreshness("2026-08-01T00:00:00Z", now)).toBe("current");
    expect(offerFreshness("2026-06-01T00:00:00Z", now)).toBe("stale");
    expect(offerFreshness(null, now)).toBe("unknown");
  });
  it("detects product matches without auto-merging", () => {
    expect(
      probableProductDuplicate(
        { name: "Queen Platform Bed", brand: "Zinus" },
        { name: "queen-platform bed", brand: "zinus" },
      ),
    ).toBe(true);
    expect(
      probableProductDuplicate(
        { name: "Bed", manufacturerPartNumber: "ZJ-08" },
        { name: "Frame", manufacturerPartNumber: "zj 08" },
      ),
    ).toBe(true);
  });
  it("normalizes retailer URLs while preserving canonical parameters", () => {
    expect(
      canonicalizeRetailerUrl(
        "https://amazon.com/dp/ABC?utm_source=x&sku=one#offer",
      ),
    ).toBe("https://amazon.com/dp/ABC?sku=one");
    expect(() => canonicalizeRetailerUrl("javascript:alert(1)")).toThrow(
      "OFFER_URL_INVALID",
    );
  });
  it("uses pack size only to derive purchases", () => {
    expect(requiredPurchases(12, 6)).toBe(2);
    expect(requiredPurchases(13, 6)).toBe(3);
  });
  it("parses decimal prices into minor units and reports concrete attention", () => {
    expect(minorUnits("154.64")).toEqual({
      amountMinor: 15464,
      currency: "USD",
    });
    expect(
      catalogAttention({
        categoryId: null,
        roomCount: 0,
        primaryMediaId: null,
        activeOffers: [],
      }),
    ).toEqual([
      "Missing category",
      "Missing room assignment",
      "Missing image",
      "No active offer",
    ]);
  });
});
