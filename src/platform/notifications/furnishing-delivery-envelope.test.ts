import { describe, expect, it, vi } from "vitest";
import { deliverThroughAdapter, guardDeliveryEffect, hydrateDeliveryEnvelope } from "./furnishing-delivery-envelope";

const row = (family: unknown = "furnishing") => ({ id: "n1", workspace_id: "w1", channel: "email", product_family: family, idempotency_key: "k1", attempt_count: 2 });
describe("FS-008A P2.2C shared delivery envelope", () => {
  it.each(["normal", "scheduled", "retry", "replay", "bulk", "manual_resend"])("preserves metadata through %s", (mode) => expect(hydrateDeliveryEnvelope(row(), mode as never).productFamily).toBe("furnishing"));
  it.each(["email", "sms", "in-app", "slack", "teams"])("suppresses %s before provider effect", async (channel) => { const provider = vi.fn(async () => undefined); const envelope = hydrateDeliveryEnvelope({ ...row(), channel }); const result = await deliverThroughAdapter(envelope, provider); expect(result.status).toBe("suppressed"); expect(provider).not.toHaveBeenCalled(); });
  it("keeps non-Furnishing behavior unchanged", async () => { const provider = vi.fn(async () => undefined); const result = await deliverThroughAdapter(hydrateDeliveryEnvelope(row("hpm")), provider); expect(result.status).toBe("delivered"); expect(provider).toHaveBeenCalledOnce(); });
  it("rejects ambiguous product-family values", () => expect(() => hydrateDeliveryEnvelope(row("unknown"))).toThrow("NOTIFICATION_PRODUCT_FAMILY_INVALID"));
  it("returns stable idempotent suppression", () => expect(guardDeliveryEffect(hydrateDeliveryEnvelope(row()))).toEqual(guardDeliveryEffect(hydrateDeliveryEnvelope(row()))));
});
