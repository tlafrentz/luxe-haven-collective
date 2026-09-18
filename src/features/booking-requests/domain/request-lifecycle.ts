export const BOOKING_REQUEST_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "alternate_proposed",
  "approved",
  "awaiting_payment",
  "confirmed",
  "payment_failed",
  "declined",
  "withdrawn",
  "expired",
] as const;

export type BookingRequestStatus = (typeof BOOKING_REQUEST_STATUSES)[number];

// LHS-WF-001: state transitions shall be server-authorized and validated
// against the current state. Mirrors ORDER_TRANSITIONS in
// src/platform/commerce/application/payments.ts.
const REQUEST_TRANSITIONS: Readonly<Record<BookingRequestStatus, readonly BookingRequestStatus[]>> = Object.freeze({
  draft: ["submitted", "expired"],
  submitted: ["under_review", "withdrawn", "expired"],
  under_review: ["alternate_proposed", "approved", "declined", "withdrawn"],
  alternate_proposed: ["submitted", "withdrawn", "expired"],
  approved: ["awaiting_payment", "declined", "expired"],
  awaiting_payment: ["confirmed", "payment_failed", "expired"],
  confirmed: [],
  payment_failed: ["awaiting_payment", "expired"],
  declined: [],
  withdrawn: [],
  expired: [],
});

export class InvalidBookingRequestTransition extends Error {
  constructor(
    public readonly current: BookingRequestStatus,
    public readonly next: BookingRequestStatus,
  ) {
    super(`Booking request cannot transition from ${current} to ${next}.`);
    this.name = "InvalidBookingRequestTransition";
  }
}

export function assertBookingRequestTransition(current: BookingRequestStatus, next: BookingRequestStatus): void {
  if (current === next) return;
  if (!REQUEST_TRANSITIONS[current].includes(next)) {
    throw new InvalidBookingRequestTransition(current, next);
  }
}

export function isTerminalBookingRequestStatus(status: BookingRequestStatus): boolean {
  return REQUEST_TRANSITIONS[status].length === 0;
}
