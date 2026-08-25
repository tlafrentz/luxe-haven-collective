"use server";

import { requireUser } from "@/lib/auth/session";
import { createProductionFurnishingLifecycleRepository } from "@/platform/commerce/infrastructure/production-furnishing-handoff";

type RpcResult = Readonly<{ ok: true; result: Record<string, unknown> }> | Readonly<{ ok: false; code: string }>;
const failure = (error: unknown): RpcResult => ({ ok: false, code: error instanceof Error ? error.message : "FURNISHING_LIFECYCLE_UNAVAILABLE" });

export async function createOrReplayFurnishingHandoff(input: Readonly<{ entitlementId: string; idempotencyKey: string; correlationId: string }>): Promise<RpcResult> {
  try { await requireUser(); const value = await createProductionFurnishingLifecycleRepository(); return { ok: true, result: await value.createOrReplayHandoff(input.entitlementId, input.idempotencyKey, input.correlationId) }; } catch (error) { return failure(error); }
}

export async function startOrResumeFurnishingOnboarding(input: Readonly<{ handoffId: string; expectedVersion: number; idempotencyKey: string; correlationId: string }>): Promise<RpcResult> {
  try { await requireUser(); const value = await createProductionFurnishingLifecycleRepository(); return { ok: true, result: await value.startOrResumeSession(input.handoffId, input.expectedVersion, input.idempotencyKey, input.correlationId) }; } catch (error) { return failure(error); }
}

export async function activateFurnishingOnboardingProject(input: Readonly<{ sessionId: string; snapshotId: string; expectedVersion: number; idempotencyKey: string; correlationId: string }>): Promise<RpcResult> {
  try { await requireUser(); const value = await createProductionFurnishingLifecycleRepository(); return { ok: true, result: await value.activateProject(input.sessionId, input.snapshotId, input.expectedVersion, input.idempotencyKey, input.correlationId) }; } catch (error) { return failure(error); }
}

export async function transitionFurnishingOnboardingRecovery(input: Readonly<{ handoffId: string; sessionId: string; toState: string; expectedHandoffVersion: number; expectedSessionVersion: number; idempotencyKey: string; reason: string; correlationId: string }>): Promise<RpcResult> {
  try { await requireUser(); const value = await createProductionFurnishingLifecycleRepository(); return { ok: true, result: await value.transitionRecovery(input.handoffId, input.sessionId, input.toState, input.expectedHandoffVersion, input.expectedSessionVersion, input.idempotencyKey, input.reason, input.correlationId) }; } catch (error) { return failure(error); }
}
