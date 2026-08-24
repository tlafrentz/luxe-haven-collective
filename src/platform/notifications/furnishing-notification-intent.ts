import type { ExecuteNotificationIntent } from "@/platform/actions/application/execute-application";

/** Canonical notification kinds emitted by Furnishing workflows. */
export type FurnishingNotificationKind =
  | "project-created"
  | "project-status-changed"
  | "onboarding"
  | "design-review"
  | "design-approved"
  | "budget-approved"
  | "budget-exception"
  | "procurement-ready"
  | "product-availability-changed"
  | "installation-scheduled"
  | "installation-status-changed"
  | "launch-ready"
  | "admin-manual"
  | "scheduled-reminder"
  | "failure"
  | "recovery"
  | "escalation";

type FurnishingIntentInput = Omit<ExecuteNotificationIntent, "eventType" | "productFamily"> & {
  kind: FurnishingNotificationKind;
};

/**
 * The only supported producer boundary for Furnishing notifications.
 * Product family is deliberately not caller-controlled and cannot be omitted,
 * cleared, or replaced after construction.
 */
export function createFurnishingNotificationIntent(input: FurnishingIntentInput): ExecuteNotificationIntent {
  return Object.freeze({
    ...input,
    eventType: `furnishing.${input.kind}`,
    productFamily: "furnishing" as const,
  });
}
