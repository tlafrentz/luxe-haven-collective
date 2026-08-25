"use server";

import { requireUser } from "@/lib/auth/session";
import { createOrReplayFurnishingHandoff as createHandoff, startOrResumeFurnishingOnboarding as startOnboarding, activateFurnishingOnboardingProject as activateProject, transitionFurnishingOnboardingRecovery as transitionRecovery } from "@/platform/commerce";

type RpcResult = Readonly<{ ok: true; result: Record<string, unknown> }> | Readonly<{ ok: false; code: string }>;
const failure = (error: unknown): RpcResult => ({ ok: false, code: error instanceof Error ? error.message : "FURNISHING_LIFECYCLE_UNAVAILABLE" });

export async function createOrReplayFurnishingHandoff(input: Readonly<{ entitlementId: string; idempotencyKey: string; correlationId: string }>): Promise<RpcResult> {
  try { await requireUser(); return { ok: true, result: await createHandoff(input) }; } catch (error) { return failure(error); }
}

export async function startOrResumeFurnishingOnboarding(input: Readonly<{ handoffId: string; expectedVersion: number; idempotencyKey: string; correlationId: string }>): Promise<RpcResult> {
  try { await requireUser(); return { ok: true, result: await startOnboarding(input) }; } catch (error) { return failure(error); }
}

export async function activateFurnishingOnboardingProject(input: Readonly<{ sessionId: string; snapshotId: string; expectedVersion: number; idempotencyKey: string; correlationId: string }>): Promise<RpcResult> {
  try { await requireUser(); return { ok: true, result: await activateProject(input) }; } catch (error) { return failure(error); }
}

export async function transitionFurnishingOnboardingRecovery(input: Readonly<{ handoffId: string; sessionId: string; toState: string; expectedHandoffVersion: number; expectedSessionVersion: number; idempotencyKey: string; reason: string; correlationId: string }>): Promise<RpcResult> {
  try { await requireUser(); return { ok: true, result: await transitionRecovery(input) }; } catch (error) { return failure(error); }
}
