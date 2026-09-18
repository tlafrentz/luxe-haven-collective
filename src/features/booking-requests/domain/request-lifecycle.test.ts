import { describe, expect, it } from "vitest";
import { assertBookingRequestTransition, InvalidBookingRequestTransition, isTerminalBookingRequestStatus } from "./request-lifecycle";

describe("assertBookingRequestTransition", () => {
  it("allows every transition in the PRD §4.1 lifecycle table", () => {
    const allowed: [string, string][] = [
      ["draft", "submitted"],
      ["submitted", "under_review"],
      ["submitted", "withdrawn"],
      ["under_review", "alternate_proposed"],
      ["under_review", "approved"],
      ["under_review", "declined"],
      ["alternate_proposed", "submitted"],
      ["approved", "awaiting_payment"],
      ["approved", "declined"],
      ["awaiting_payment", "confirmed"],
      ["awaiting_payment", "payment_failed"],
      ["payment_failed", "awaiting_payment"],
    ];
    for (const [from, to] of allowed) {
      expect(() => assertBookingRequestTransition(from as never, to as never)).not.toThrow();
    }
  });

  it("is a no-op when the status does not change", () => {
    expect(() => assertBookingRequestTransition("submitted", "submitted")).not.toThrow();
  });

  it("rejects skipping the review step straight to confirmed", () => {
    expect(() => assertBookingRequestTransition("submitted", "confirmed")).toThrow(InvalidBookingRequestTransition);
  });

  it("rejects any transition out of a terminal status", () => {
    for (const terminal of ["confirmed", "declined", "withdrawn", "expired"] as const) {
      expect(() => assertBookingRequestTransition(terminal, "submitted")).toThrow(InvalidBookingRequestTransition);
    }
  });

  it("rejects re-approving an already-confirmed request (LHS-DOD-004 style bypass attempt)", () => {
    expect(() => assertBookingRequestTransition("confirmed", "awaiting_payment")).toThrow(InvalidBookingRequestTransition);
  });
});

describe("isTerminalBookingRequestStatus", () => {
  it("identifies terminal states", () => {
    expect(isTerminalBookingRequestStatus("confirmed")).toBe(true);
    expect(isTerminalBookingRequestStatus("declined")).toBe(true);
    expect(isTerminalBookingRequestStatus("withdrawn")).toBe(true);
    expect(isTerminalBookingRequestStatus("expired")).toBe(true);
    expect(isTerminalBookingRequestStatus("submitted")).toBe(false);
    expect(isTerminalBookingRequestStatus("awaiting_payment")).toBe(false);
  });
});
