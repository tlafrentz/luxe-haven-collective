import { startOrResumeFurnishingOnboarding, activateFurnishingOnboardingProject, transitionFurnishingOnboardingRecovery } from "@/app/actions/furnishing-onboarding-rpc";

export default async function FurnishingOnboardingCommandPage({ searchParams }: { searchParams: Promise<{ handoff_id?: string; session_id?: string; snapshot_id?: string; version?: string; recover?: string; reason?: string }> }) {
  const p = await searchParams;
  const start = p.handoff_id ? await startOrResumeFurnishingOnboarding({ handoffId: p.handoff_id, expectedVersion: Number(p.version ?? 1), idempotencyKey: `onboarding:${p.handoff_id}`, correlationId: `onboarding:${p.handoff_id}` }) : null;
  const sessionId = p.session_id ?? (start?.ok ? String(start.result.id ?? "") : "");
  const activation = p.snapshot_id && sessionId ? await activateFurnishingOnboardingProject({ sessionId, snapshotId: p.snapshot_id, expectedVersion: Number(p.version ?? 1), idempotencyKey: `activation:${sessionId}`, correlationId: `activation:${sessionId}` }) : null;
  const recovery = p.recover && p.handoff_id && sessionId ? await transitionFurnishingOnboardingRecovery({ handoffId: p.handoff_id, sessionId, toState: p.recover, expectedHandoffVersion: Number(p.version ?? 1), expectedSessionVersion: Number(p.version ?? 1), idempotencyKey: `recovery:${sessionId}:${p.recover}`, reason: p.reason ?? "customer requested recovery", correlationId: `recovery:${sessionId}` }) : null;
  return <main className="container-shell py-12"><h1 className="font-serif text-3xl">Furnishing onboarding</h1><p className="mt-3 text-sm text-stone-600">{activation?.ok ? "Activation completed." : recovery?.ok ? "Recovery transition recorded." : start?.ok ? "Onboarding session ready to resume." : "Provide an authorized onboarding handoff to continue."}</p></main>;
}
