import { describe, expect, it } from "vitest";
import { calculateProvisionalQuote } from "./quote";

describe("calculateProvisionalQuote", () => {
  it("computes nights, subtotal, cleaning fee, tax, and total from configured property rates", () => {
    const quote = calculateProvisionalQuote(
      { nightlyRate: 148, cleaningFee: 145, taxRate: 0.0825 },
      { arrival: "2026-10-08", departure: "2026-10-17" },
    );

    expect(quote.nights).toBe(9);
    expect(quote.nightlyRateMinor).toBe(14_800);
    expect(quote.subtotalMinor).toBe(133_200);
    expect(quote.cleaningFeeMinor).toBe(14_500);
    // tax on (subtotal + cleaning) at 8.25%
    expect(quote.taxMinor).toBe(Math.round((133_200 + 14_500) * 0.0825));
    expect(quote.totalMinor).toBe(quote.subtotalMinor + quote.cleaningFeeMinor + quote.taxMinor);
    expect(quote.currency).toBe("USD");
  });

  it("defaults tax to zero when the property has no configured tax rate", () => {
    const quote = calculateProvisionalQuote(
      { nightlyRate: 100, cleaningFee: 0, taxRate: null },
      { arrival: "2026-10-08", departure: "2026-10-09" },
    );
    expect(quote.taxMinor).toBe(0);
    expect(quote.totalMinor).toBe(10_000);
  });

  it("rejects a departure on or before the arrival date", () => {
    expect(() =>
      calculateProvisionalQuote({ nightlyRate: 100, cleaningFee: 0, taxRate: 0 }, { arrival: "2026-10-08", departure: "2026-10-08" }),
    ).toThrow();
    expect(() =>
      calculateProvisionalQuote({ nightlyRate: 100, cleaningFee: 0, taxRate: 0 }, { arrival: "2026-10-08", departure: "2026-10-07" }),
    ).toThrow();
  });
});
