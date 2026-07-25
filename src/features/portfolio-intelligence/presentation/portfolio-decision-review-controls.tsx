"use client";

import { useState, useTransition } from "react";
import {
  commandPortfolioDecisionAction, createPortfolioDecisionAction,
  type PortfolioDecisionActionResult,
} from "@/app/actions/portfolio-decisions-runtime";
import type {
  PortfolioDecisionCandidate, PortfolioStrategicDecision,
} from "../application/decisions/contracts";

export function PortfolioDecisionReviewControls({ candidate, decision, canApprove }: Readonly<{
  candidate: PortfolioDecisionCandidate;
  decision?: PortfolioStrategicDecision;
  canApprove: boolean;
}>) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<PortfolioDecisionActionResult | null>(null);
  const [selectedAlternativeId, setSelectedAlternativeId] = useState(
    decision?.selectedAlternativeId ?? candidate.recommendedAlternativeId ?? candidate.alternatives[0]?.id ?? "",
  );
  const [rationale, setRationale] = useState("");
  const [reviewAt, setReviewAt] = useState("");

  const create = () => startTransition(async () => {
    setFeedback(await createPortfolioDecisionAction({
      candidateId: candidate.id, commandId: crypto.randomUUID(),
      periodPreset: "90d", comparisonType: "previous-period",
    }));
  });
  const command = (commandType: "approve" | "reject" | "defer" | "request-evidence") =>
    startTransition(async () => {
      if (!decision) return;
      setFeedback(await commandPortfolioDecisionAction({
        decisionId: decision.decisionId, candidateId: candidate.id,
        commandId: crypto.randomUUID(), commandType, expectedRevision: decision.revision,
        selectedAlternativeId, rationale, reviewAt: reviewAt ? new Date(`${reviewAt}T12:00:00Z`).toISOString() : undefined,
        periodPreset: "90d", comparisonType: "previous-period",
      }));
    });

  if (!canApprove) return <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm" role="status">You have review-only access. Only a workspace owner can approve or reject this capital decision.</aside>;
  if (!decision) return <section aria-labelledby="create-review-heading" className="rounded-2xl border border-stone-200 bg-white p-6"><h2 id="create-review-heading" className="text-xl font-semibold">Start governed review</h2><p className="mt-2 text-sm text-stone-600">Creates a review record only. No capital or execution work is authorized.</p><button disabled={pending} onClick={create} className="mt-5 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Creating review…" : "Create portfolio decision review"}</button><Feedback result={feedback} /></section>;

  return <section aria-labelledby="decision-actions-heading" className="rounded-2xl border border-stone-200 bg-white p-6">
    <h2 id="decision-actions-heading" className="text-xl font-semibold">Decision actions</h2>
    <p className="mt-2 text-sm text-stone-600">Approval is explicit and idempotent. It creates editable Action Center drafts; it does not move funds.</p>
    <div className="mt-5 grid gap-4">
      <label className="text-sm font-semibold">Selected alternative<select value={selectedAlternativeId} onChange={(event) => setSelectedAlternativeId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 px-3 font-normal">{candidate.alternatives.map((item) => <option key={item.id} value={item.id}>{item.label}{item.baseline ? " — baseline" : ""}</option>)}</select></label>
      <label className="text-sm font-semibold">Decision rationale<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-stone-300 p-3 font-normal" placeholder="Explain the selected alternative, expected outcomes, assumptions, and accepted tradeoffs." /></label>
      <label className="text-sm font-semibold">Review date<input value={reviewAt} onChange={(event) => setReviewAt(event.target.value)} type="date" className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 px-3 font-normal" /></label>
    </div>
    <div className="mt-5 flex flex-wrap gap-3">
      <button disabled={pending || !rationale.trim() || !reviewAt} onClick={() => command("approve")} className="rounded-full bg-teal-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Approve selected alternative</button>
      <button disabled={pending} onClick={() => command("reject")} className="rounded-full border border-rose-300 px-5 py-3 text-sm font-semibold text-rose-800 disabled:opacity-50">Reject recommendation</button>
      <button disabled={pending} onClick={() => command("defer")} className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold disabled:opacity-50">Defer decision</button>
      <button disabled={pending} onClick={() => command("request-evidence")} className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold disabled:opacity-50">Request more evidence</button>
    </div>
    <Feedback result={feedback} />
  </section>;
}

function Feedback({ result }: Readonly<{ result: PortfolioDecisionActionResult | null }>) {
  return result ? <p role={result.ok ? "status" : "alert"} tabIndex={result.ok ? undefined : -1} className={`mt-4 rounded-xl p-3 text-sm ${result.ok ? "bg-teal-50 text-teal-900" : "bg-rose-50 text-rose-900"}`}>{result.message}</p> : null;
}

