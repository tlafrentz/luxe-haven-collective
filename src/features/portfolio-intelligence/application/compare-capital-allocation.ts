import type { CapitalAllocationAssessment, CapitalAllocationCandidateId, CapitalAllocationPortfolioPosture } from "../domain";

export type CapitalAllocationRankChange = Readonly<{ candidateId: CapitalAllocationCandidateId; previousRank: number | null; currentRank: number | null }>;
export type CapitalAllocationAssessmentChange = Readonly<{
  portfolioId: import("@/features/portfolio").PortfolioId; comparable: boolean;
  previousPrimaryCandidateId?: string; currentPrimaryCandidateId?: string;
  postureChange?: { from: CapitalAllocationPortfolioPosture; to: CapitalAllocationPortfolioPosture };
  newlyFeasibleCandidates: readonly CapitalAllocationCandidateId[]; newlyInfeasibleCandidates: readonly CapitalAllocationCandidateId[];
  rankChanges: readonly CapitalAllocationRankChange[]; resolvedConstraints: readonly string[]; newConstraints: readonly string[];
}>;
export function compareCapitalAllocation(previous: CapitalAllocationAssessment, current: CapitalAllocationAssessment): CapitalAllocationAssessmentChange {
  if (!previous.portfolioId.equals(current.portfolioId)) throw new RangeError("Capital allocation assessments must belong to the same portfolio.");
  const comparable = previous.allocationPolicyVersion === current.allocationPolicyVersion && previous.healthPolicyVersion === current.healthPolicyVersion;
  if (!comparable) return Object.freeze({ portfolioId: current.portfolioId, comparable: false, newlyFeasibleCandidates: Object.freeze([]), newlyInfeasibleCandidates: Object.freeze([]), rankChanges: Object.freeze([]), resolvedConstraints: Object.freeze([]), newConstraints: Object.freeze([]) });
  const before = new Map(previous.candidates.map((value) => [value.candidate.id.value, value]));
  const after = new Map(current.candidates.map((value) => [value.candidate.id.value, value]));
  const ids = [...new Set([...before.keys(), ...after.keys()])].sort();
  const became = (from: boolean, to: boolean) => ids.filter((id) => Boolean(before.get(id)) && Boolean(after.get(id)) && from === feasible(before.get(id)!) && to === feasible(after.get(id)!)).map((id) => after.get(id)!.candidate.id);
  const rankChanges = ids.flatMap((id) => {
    const left = before.get(id), right = after.get(id);
    return left && right && left.rank !== right.rank ? [Object.freeze({ candidateId: right.candidate.id, previousRank: left.rank, currentRank: right.rank })] : [];
  });
  const beforeConstraints = new Set(previous.constraints.map((value) => `${value.code}\0${value.candidateId?.value ?? ""}`));
  const afterConstraints = new Set(current.constraints.map((value) => `${value.code}\0${value.candidateId?.value ?? ""}`));
  return Object.freeze({
    portfolioId: current.portfolioId, comparable: true,
    ...(previous.primaryCandidateId ? { previousPrimaryCandidateId: previous.primaryCandidateId.value } : {}),
    ...(current.primaryCandidateId ? { currentPrimaryCandidateId: current.primaryCandidateId.value } : {}),
    ...(previous.recommendedPosture !== current.recommendedPosture ? { postureChange: Object.freeze({ from: previous.recommendedPosture, to: current.recommendedPosture }) } : {}),
    newlyFeasibleCandidates: Object.freeze(became(false, true)), newlyInfeasibleCandidates: Object.freeze(became(true, false)),
    rankChanges: Object.freeze(rankChanges),
    resolvedConstraints: Object.freeze([...beforeConstraints].filter((value) => !afterConstraints.has(value)).sort()),
    newConstraints: Object.freeze([...afterConstraints].filter((value) => !beforeConstraints.has(value)).sort()),
  });
}
function feasible(value: CapitalAllocationAssessment["candidates"][number]) { return value.feasibility.status === "feasible" || value.feasibility.status === "conditionally-feasible"; }
