// PA-008: canonical logic moved to src/platform/furnishing-activation-policy.ts
// (the platform-importable location -- src/platform/ code is architecturally
// forbidden from importing src/features/*, so the shared copy has to live
// there; this file re-exports it since features importing platform is fine).
export {
  resolveFurnishingActivation,
  type FurnishingActivationContext,
  type FurnishingActivationDecision,
  type FurnishingDecisionReason,
  type FurnishingGlobalState,
} from "@/platform/furnishing-activation-policy";

/** FS-008A safe ceiling: every activation/effect mutation is denied. */
export function assertFurnishingActivationMutationDisabled(): void {
  throw new Error("FURNISHING_ACTIVATION_DISABLED");
}
