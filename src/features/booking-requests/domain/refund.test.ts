import { describe, expect, it } from "vitest";
import { computeRefundable, sumCommittedRefunds, sumSucceededRefunds, validateRefundRequest } from "./refund";

describe("refund ledger math", () => {
  it("ignores failed and canceled refunds when computing what is refundable", () => {
    const entries = [
      { amountMinor: 30_000, status: "succeeded" as const },
      { amountMinor: 10_000, status: "pending" as const },
      { amountMinor: 50_000, status: "failed" as const },
      { amountMinor: 20_000, status: "canceled" as const },
    ];
    expect(sumCommittedRefunds(entries)).toBe(40_000);
    expect(sumSucceededRefunds(entries)).toBe(30_000);
    expect(computeRefundable(163_800, entries)).toBe(123_800);
  });

  it("never reports a negative refundable balance", () => {
    expect(computeRefundable(100, [{ amountMinor: 500, status: "succeeded" }])).toBe(0);
  });
});

describe("validateRefundRequest", () => {
  const base = { amountMinor: 5_000, reason: "Guest illness", refundableMinor: 10_000 };

  it("accepts a valid partial refund and a full-remaining refund", () => {
    expect(validateRefundRequest(base)).toBeNull();
    expect(validateRefundRequest({ ...base, amountMinor: 10_000 })).toBeNull();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("rejects amount %s", (amountMinor) => {
    expect(validateRefundRequest({ ...base, amountMinor })).toBe("invalid_amount");
  });

  it("rejects amounts above what remains refundable", () => {
    expect(validateRefundRequest({ ...base, amountMinor: 10_001 })).toBe("exceeds_refundable");
  });

  it("requires a non-blank reason of bounded length", () => {
    expect(validateRefundRequest({ ...base, reason: "   " })).toBe("reason_required");
    expect(validateRefundRequest({ ...base, reason: "x".repeat(501) })).toBe("reason_too_long");
  });
});
