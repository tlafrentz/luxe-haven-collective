import { describe, expect, it } from "vitest";
import {
  activationIdempotencyKey,
  offerReadiness,
  preserveOrderSnapshot,
  separateOrderStatuses,
} from "./domain";
describe("offer catalog domain", () => {
  it("requires a complete commercial path before publishing", () =>
    expect(
      offerReadiness({
        name: "Offer",
        slug: "offer",
        offerType: "digital_product",
        fulfillmentModel: "immediate_access",
        paymentModel: "one_time",
        activationSteps: 0,
        priceCount: 1,
      }),
    ).toEqual({ ready: false, missing: ["activation workflow"] }));
  it("creates stable activation idempotency", () =>
    expect(activationIdempotencyKey("o1", "f1", 2)).toBe("activate:o1:f1:v2"));
  it("preserves historical snapshots", () => {
    const offer = { name: "Original", deliverables: ["PDF"] },
      snapshot = preserveOrderSnapshot(offer);
    offer.name = "Changed";
    expect(snapshot.name).toBe("Original");
  });
  it("keeps payment activation and fulfillment distinct", () =>
    expect(
      separateOrderStatuses({
        payment: "paid",
        activation: "in_progress",
        fulfillment: "ready",
      }),
    ).toEqual({
      payment: "paid",
      activation: "in_progress",
      fulfillment: "ready",
    }));
});
