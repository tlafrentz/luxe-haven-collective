"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, RefreshCw } from "lucide-react";
import {
  activateAcquisitionPipelineAction,
  beginClosingPreparationAction,
} from "@/app/actions/acquisition-workspace-commands";
import { Card } from "@/components/ui/card";
import type {
  AcquisitionWorkspaceNextAction,
  InvestmentAnalysisWorkspaceSummary,
  InvestmentOpportunityWorkspaceSummary,
} from "../acquisition-workspace";
import type { AcquisitionServerCommandResult } from "../acquisition-server";

export function AcquisitionPrimaryAction({ action, opportunity, analysis }: {
  action: AcquisitionWorkspaceNextAction | null;
  opportunity: InvestmentOpportunityWorkspaceSummary;
  analysis: InvestmentAnalysisWorkspaceSummary | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AcquisitionServerCommandResult | null>(null);

  if (!action) return null;
  const executable = action.enabled && action.command && (
    action.command.commandType === "activate" ||
    action.command.commandType === "prepare-closing"
  );

  function execute() {
    if (!action?.command || !executable) return;
    const idempotencyKey = crypto.randomUUID();
    startTransition(async () => {
      const next = action.command!.commandType === "activate" && analysis
        ? await activateAcquisitionPipelineAction({
          commandType: "activate-pipeline",
          envelope: {
            opportunityId: action.command!.opportunityId,
            expectedOpportunityVersion: action.command!.expectedOpportunityVersion,
            idempotencyKey,
          },
          analysisId: analysis.analysisId,
          analysisVersion: analysis.version,
          route: opportunity.route,
        })
        : action.command!.commandType === "prepare-closing" && action.command!.pipelineId && action.command!.expectedPipelineVersion
          ? await beginClosingPreparationAction({
            commandType: "begin-closing-preparation",
            envelope: {
              opportunityId: action.command!.opportunityId,
              pipelineId: action.command!.pipelineId,
              expectedOpportunityVersion: action.command!.expectedOpportunityVersion,
              expectedPipelineVersion: action.command!.expectedPipelineVersion,
              idempotencyKey,
            },
          })
          : null;
      if (!next) return;
      setResult(next);
      if (next.status === "succeeded") router.refresh();
    });
  }

  return <Card className="border-stone-800 bg-stone-950 p-5 text-white sm:p-6" aria-live="polite">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Recommended next action</p>
    <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h3 className="text-xl font-semibold">{action.label}</h3><p className="mt-1 max-w-2xl text-sm text-stone-300">{action.description}</p></div>
      {action.enabled && action.href ? <Link href={action.href} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400">Continue <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        : executable ? <button type="button" onClick={execute} disabled={pending} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-stone-950 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400">{pending ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{pending ? "Updating lifecycle…" : action.label}</button>
          : <button type="button" disabled className="shrink-0 rounded-lg border border-stone-700 px-5 py-3 text-sm font-semibold text-stone-400">{action.enabled ? "Workflow details required" : "Unavailable"}</button>}
    </div>
    {action.blockers.length ? <ul className="mt-4 space-y-1 border-t border-stone-800 pt-4 text-sm text-amber-200">{action.blockers.map(blocker => <li key={`${blocker.code}-${blocker.sourceId ?? ""}`}>{blocker.message}</li>)}</ul> : null}
    {result?.status === "succeeded" ? <div role="status" className="mt-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-100"><strong>Stage complete.</strong> The workspace has been refreshed with the latest lifecycle state.</div> : null}
    {result?.status === "conflict" ? <div role="alert" className="mt-4 rounded-lg bg-amber-950 p-3 text-sm text-amber-100">This acquisition changed after the page loaded. <button type="button" onClick={() => router.refresh()} className="ml-2 inline-flex items-center gap-1 font-semibold underline"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Reload workspace</button></div> : null}
    {result && !["succeeded", "conflict"].includes(result.status) ? <p role="alert" className="mt-4 rounded-lg bg-rose-950 p-3 text-sm text-rose-100">{result.status === "unavailable" ? "This action is not available in the current deployment." : result.status === "blocked" ? "Resolve the listed blockers before continuing." : "The action could not be completed safely."}</p> : null}
  </Card>;
}
