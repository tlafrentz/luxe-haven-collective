"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPreferredScenarioAction } from "@/app/actions/investment-opportunity-workflow";

export function PreferredScenarioButton({ opportunityId, scenarioId, expectedVersion }: { opportunityId: string; scenarioId: string; expectedVersion: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" disabled={pending} onClick={() => startTransition(async () => {
    const result = await markPreferredScenarioAction({ opportunityId, scenarioId, expectedVersion, idempotencyKey: `preferred:${crypto.randomUUID()}` });
    if (result.ok) router.refresh();
  })} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">{pending ? "Updating…" : "Mark preferred"}</button>;
}
