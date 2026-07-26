import { describe, expect, it } from "vitest";
import { Money } from "@/platform/kernel";
import { assertFinancialPeriod, FinancialTransaction } from "./model";

const transaction = () => FinancialTransaction.create({
  id: "tx-1", accountId: "revenue", workspaceId: "workspace-1", propertyId: "property-1",
  amount: Money.usd(100.25), category: "accommodation", measurement: "measured",
  effectiveDate: "2026-07-01", source: { provider: "stripe", externalId: "source-1" },
  status: "pending", evidenceIds: ["evidence-1"],
});

describe("financial domain", () => {
  it("uses precision-safe, currency-aware shared Money", () => {
    expect(Money.usd(.1).add(Money.usd(.2)).amount).toBe(.3);
    expect(Money.of(1000, "JPY").minorUnits).toBe(1000);
    expect(Money.fromMinorUnits(12345, "USD").serialize()).toEqual({ amount: 123.45, currency: "USD", minorUnits: 12345, precision: 2 });
    expect(() => Money.usd(1).add(Money.of(1, "EUR"))).toThrow(/Cannot combine/);
  });

  it("makes posted transactions immutable while revisions create new values", () => {
    const pending = transaction();
    expect(pending.revise({ amount: Money.usd(200) }).props.amount.amount).toBe(200);
    const posted = pending.post("2026-07-02");
    expect(posted.props.status).toBe("posted");
    expect(() => posted.revise({ amount: Money.usd(300) })).toThrowError(/immutable/i);
    expect(() => posted.post("2026-07-03")).toThrowError(/immutable/i);
  });

  it("requires explicit valid current and comparison periods", () => {
    expect(() => assertFinancialPeriod({ kind: "month", from: "2026-07-01", to: "2026-07-31", comparison: { from: "2026-06-01", to: "2026-06-30" }, reportingCalendar: "fiscal" })).not.toThrow();
    expect(() => assertFinancialPeriod({ kind: "custom", from: "2026-08-01", to: "2026-07-01", reportingCalendar: "calendar" })).toThrow(/period/i);
  });
});
