/**
 * Refund rules (LHS-CAN-001..003). Pure so the cap/validation logic is
 * testable without Stripe or the database. Business refund policy is still an
 * open PRD decision, so the operator chooses the amount and gives a reason;
 * these rules only guarantee the ledger can never promise more than was paid.
 */
export type RefundStatus = "requested" | "pending" | "succeeded" | "failed" | "canceled";

export type RefundLedgerEntry = Readonly<{ amountMinor: number; status: RefundStatus }>;

export const REFUND_REASON_MAX_LENGTH = 500;

/** Failed and canceled refunds returned nothing to the guest, so they don't count. */
export function sumCommittedRefunds(entries: readonly RefundLedgerEntry[]): number {
  return entries.reduce((sum, entry) => (entry.status === "failed" || entry.status === "canceled" ? sum : sum + entry.amountMinor), 0);
}

export function sumSucceededRefunds(entries: readonly RefundLedgerEntry[]): number {
  return entries.reduce((sum, entry) => (entry.status === "succeeded" ? sum + entry.amountMinor : sum), 0);
}

export function computeRefundable(paidMinor: number, entries: readonly RefundLedgerEntry[]): number {
  return Math.max(0, paidMinor - sumCommittedRefunds(entries));
}

export type RefundValidationCode = "invalid_amount" | "reason_required" | "reason_too_long" | "exceeds_refundable";

export function validateRefundRequest(input: Readonly<{ amountMinor: number; reason: string; refundableMinor: number }>): RefundValidationCode | null {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) return "invalid_amount";
  const reason = input.reason.trim();
  if (!reason) return "reason_required";
  if (reason.length > REFUND_REASON_MAX_LENGTH) return "reason_too_long";
  if (input.amountMinor > input.refundableMinor) return "exceeds_refundable";
  return null;
}
