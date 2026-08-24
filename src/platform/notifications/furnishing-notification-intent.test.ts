import { describe, expect, it } from "vitest";
import { createFurnishingNotificationIntent, type FurnishingNotificationKind } from "./furnishing-notification-intent";
import { deliverThroughAdapter, hydrateDeliveryEnvelope } from "./furnishing-delivery-envelope";

const base = {
  id: "notice-1", workspaceId: "workspace-1", recipientType: "user", recipientId: "user-1",
  entityType: "plan" as const, entityId: "project-1", templateVariables: {}, channel: "email" as const,
  status: "pending" as const, idempotencyKey: "notice-1", attemptCount: 0 as const,
  createdAt: new Date("2026-08-24T00:00:00Z"),
};

describe("FS-008A P2.2D Furnishing producer boundary", () => {
  it("always stamps the canonical product family and event namespace", () => {
    const kinds: FurnishingNotificationKind[] = ["project-created", "project-status-changed", "onboarding", "design-review", "design-approved", "budget-approved", "budget-exception", "procurement-ready", "product-availability-changed", "installation-scheduled", "installation-status-changed", "launch-ready", "admin-manual", "scheduled-reminder", "failure", "recovery", "escalation"];
    for (const kind of kinds) expect(createFurnishingNotificationIntent({ ...base, kind })).toMatchObject({ productFamily: "furnishing", eventType: `furnishing.${kind}` });
  });

  it("retains the family through persistence hydration and suppresses before provider effect", async () => {
    const intent = createFurnishingNotificationIntent({ ...base, kind: "recovery" });
    const envelope = hydrateDeliveryEnvelope({ id: intent.id, workspace_id: intent.workspaceId, channel: intent.channel, product_family: intent.productFamily, idempotency_key: intent.idempotencyKey, attempt_count: intent.attemptCount });
    let calls = 0;
    await expect(deliverThroughAdapter(envelope, async () => { calls += 1; })).resolves.toMatchObject({ status: "suppressed" });
    expect(calls).toBe(0);
  });

  it("rejects an unknown persisted family rather than falling back", () => {
    expect(() => hydrateDeliveryEnvelope({ id: "n", workspace_id: "w", channel: "email", product_family: "unknown", idempotency_key: "k" })).toThrow("NOTIFICATION_PRODUCT_FAMILY_INVALID");
  });
});
