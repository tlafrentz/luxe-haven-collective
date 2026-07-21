import type { ExecutiveDataQualitySummary, ExecutiveDecisionSummary, ExecutiveExecutionSummary, ExecutiveOutcomeSummary } from "../domain";
import { ExecutiveEmptyState, ExecutiveUnavailableState } from "./executive-data-state";

function providerUnavailable(dataQuality: ExecutiveDataQualitySummary, provider: string): boolean {
  return dataQuality.gaps.some((gap) => gap.type === "absent-provider" && gap.message.includes(provider));
}

function Shell({ eyebrow, title, children }: Readonly<{ eyebrow: string; title: string; children: React.ReactNode }>) {
  return <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{eyebrow}</p><h3 className="mt-2 text-lg font-semibold text-stone-950">{title}</h3><div className="mt-4">{children}</div></section>;
}

export function ExecutiveDecisionSection({ summary, dataQuality }: Readonly<{ summary: ExecutiveDecisionSummary; dataQuality: ExecutiveDataQualitySummary }>) {
  if (providerUnavailable(dataQuality, "Decision")) return <Shell eyebrow="Decide" title="Decision lifecycle"><ExecutiveUnavailableState title="Decision data unavailable" description="Decision lifecycle data is not connected to the Executive view yet." /></Shell>;
  if (summary.active + summary.readyForReview + summary.recentlyCompleted === 0) return <Shell eyebrow="Decide" title="Decision lifecycle"><ExecutiveEmptyState>No canonical decisions currently require attention.</ExecutiveEmptyState></Shell>;
  return <Shell eyebrow="Decide" title="Decision lifecycle"><div className="grid grid-cols-2 gap-3 text-sm"><Stat label="Active" value={summary.active} /><Stat label="Awaiting evidence" value={summary.awaitingEvidence} /><Stat label="Ready for review" value={summary.readyForReview} /><Stat label="Recently completed" value={summary.recentlyCompleted} /></div></Shell>;
}

export function ExecutiveExecutionSection({ summary, dataQuality }: Readonly<{ summary: ExecutiveExecutionSummary; dataQuality: ExecutiveDataQualitySummary }>) {
  if (providerUnavailable(dataQuality, "Action")) return <Shell eyebrow="Execute" title="Execution lifecycle"><ExecutiveUnavailableState title="Execution data unavailable" description="Execution lifecycle data is not yet connected to the Executive view. Action Center remains a separate workspace." href="/dashboard/actions" linkLabel="Open Action Center" /></Shell>;
  if (summary.openActions + summary.completedActions === 0) return <Shell eyebrow="Execute" title="Execution lifecycle"><ExecutiveEmptyState>No canonical actions are currently open or recently completed.</ExecutiveEmptyState></Shell>;
  return <Shell eyebrow="Execute" title="Execution lifecycle"><div className="grid grid-cols-2 gap-3 text-sm"><Stat label="Open" value={summary.openActions} /><Stat label="In progress" value={summary.inProgressActions} /><Stat label="Blocked" value={summary.blockedActions} /><Stat label="Completed" value={summary.completedActions} /></div></Shell>;
}

export function ExecutiveOutcomeSection({ summary, dataQuality }: Readonly<{ summary: ExecutiveOutcomeSummary; dataQuality: ExecutiveDataQualitySummary }>) {
  if (providerUnavailable(dataQuality, "Outcome")) return <Shell eyebrow="Learn" title="Measured outcomes"><ExecutiveUnavailableState title="Outcome data unavailable" description="Measured outcomes will appear after completed actions are evaluated by a canonical Outcome provider." /></Shell>;
  if (summary.measuredOutcomes === 0) return <Shell eyebrow="Learn" title="Measured outcomes"><ExecutiveEmptyState>No measured outcomes are available for the current lifecycle.</ExecutiveEmptyState></Shell>;
  return <Shell eyebrow="Learn" title="Measured outcomes"><div className="grid grid-cols-3 gap-3 text-sm"><Stat label="Positive" value={summary.positiveOutcomes} /><Stat label="Neutral" value={summary.neutralOutcomes} /><Stat label="Negative" value={summary.negativeOutcomes} /></div>{summary.latestOutcome ? <p className="mt-4 text-xs leading-5 text-stone-600">Latest: {summary.latestOutcome.summary}</p> : null}{summary.learningSummary ? <p className="mt-2 text-xs text-stone-500">{summary.learningSummary}</p> : null}</Shell>;
}

function Stat({ label, value }: Readonly<{ label: string; value: number }>) {
  return <div className="rounded-xl bg-stone-50 p-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-xl font-semibold text-stone-950">{value}</p></div>;
}
