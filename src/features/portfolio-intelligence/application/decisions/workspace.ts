import type { Money, PortfolioDecisionWorkspace, PortfolioStrategicDecision } from "./contracts";
import type { PortfolioFindings } from "../findings";
import type { WorkspaceRole } from "@/features/workspace";
import { detectCapitalConflicts, getCapitalAllocationCandidates } from "./build-candidates";

export function buildPortfolioDecisionWorkspace(input: Readonly<{
  findings: PortfolioFindings; decisions?: readonly PortfolioStrategicDecision[];
  role: WorkspaceRole; now?: string;
}>): PortfolioDecisionWorkspace {
  const candidates = getCapitalAllocationCandidates(input.findings);
  const decisions = input.decisions ?? [];
  const canApprove = input.role === "owner";
  const proposedCapital = aggregate(candidates.flatMap(({ requestedResources }) => requestedResources));
  const approvedCapital = aggregate(decisions.filter(({ status }) => status === "approved").flatMap(({ approvedResources }) => approvedResources));
  const now = input.now ?? input.findings.evaluatedAt;
  const state = input.findings.state === "insufficient-evidence" ? "insufficient-evidence"
    : input.findings.state === "degraded" ? "degraded"
      : !canApprove && ["operator", "contributor", "viewer"].includes(input.role) ? "permission-limited"
        : candidates.length || decisions.length ? "ready" : "empty";
  return {
    findings: input.findings, candidates, conflicts: detectCapitalConflicts(candidates),
    decisions, state, canApprove, role: input.role, evaluatedAt: now,
    summary: {
      proposedCapital, approvedCapital, committedCapital: null, spentCapital: null,
      recommendationsReady: candidates.filter(({ status }) => status === "ready-for-review").length,
      activeDecisions: decisions.filter(({ status }) => ["under-review", "approved", "deferred"].includes(status)).length,
      reviewsDue: decisions.filter(({ reviewAt }) => reviewAt && new Date(reviewAt) <= new Date(now)).length,
    },
  };
}

function aggregate(resources: readonly Readonly<{ amount?: Money; cadence: string }>[]): Money | null {
  const monetary = resources.filter((item): item is typeof item & { amount: Money } => Boolean(item.amount) && item.cadence === "one-time");
  if (!monetary.length) return null;
  const currencies = [...new Set(monetary.map(({ amount }) => amount.currency))];
  if (currencies.length !== 1) return null;
  return { amount: monetary.reduce((sum, item) => sum + item.amount.amount, 0), currency: currencies[0] };
}

