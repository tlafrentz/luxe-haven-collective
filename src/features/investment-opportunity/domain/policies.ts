import type { InvestmentOpportunityRoute, OpportunityAnalysis, OpportunityPropertyReference, OpportunityStatus } from "./model";

export type OpportunityStatusTransitionRejectionReason = "SAME_STATUS" | "INVALID_TRANSITION" | "ACQUIRED_IS_TERMINAL" | "ARCHIVED_OPPORTUNITY";
export type OpportunityStatusTransitionAssessment = Readonly<{ allowed: boolean; reason?: OpportunityStatusTransitionRejectionReason }>;
const transitions: Readonly<Record<OpportunityStatus, readonly OpportunityStatus[]>> = {
  evaluating: ["researching", "shortlisted", "rejected"], researching: ["evaluating", "shortlisted", "rejected"],
  shortlisted: ["researching", "offer-submitted", "rejected"], "offer-submitted": ["shortlisted", "under-contract", "rejected"],
  "under-contract": ["offer-submitted", "acquired", "rejected"], acquired: [], rejected: ["evaluating", "researching"],
};
export function assessOpportunityStatusTransition(current: OpportunityStatus, next: OpportunityStatus, archived = false): OpportunityStatusTransitionAssessment {
  if (archived) return { allowed: false, reason: "ARCHIVED_OPPORTUNITY" };
  if (current === next) return { allowed: false, reason: "SAME_STATUS" };
  if (current === "acquired") return { allowed: false, reason: "ACQUIRED_IS_TERMINAL" };
  return transitions[current].includes(next) ? { allowed: true } : { allowed: false, reason: "INVALID_TRANSITION" };
}
export type OpportunityAnalysisIncompatibilityReason = "ROUTE_MISMATCH" | "PROPERTY_MISMATCH" | "DUPLICATE_ANALYSIS" | "INVALID_LIFECYCLE_RESULT" | "UNSUPPORTED_SNAPSHOT_SCHEMA";
export function assessOpportunityAnalysisCompatibility(input: { route: InvestmentOpportunityRoute; property: OpportunityPropertyReference; analysis: OpportunityAnalysis; existingLifecycleResultIds?: readonly string[] }): Readonly<{ compatible: boolean; reasons: readonly OpportunityAnalysisIncompatibilityReason[] }> {
  const reasons: OpportunityAnalysisIncompatibilityReason[] = [], props = input.analysis.props;
  if (props.route !== input.route) reasons.push("ROUTE_MISMATCH");
  if (props.resultSnapshot.schemaVersion !== "1") reasons.push("UNSUPPORTED_SNAPSHOT_SCHEMA");
  if (!props.investmentAnalysisId || !props.lineage.investmentLifecycleResultId) reasons.push("INVALID_LIFECYCLE_RESULT");
  if (input.existingLifecycleResultIds?.includes(props.lineage.investmentLifecycleResultId)) reasons.push("DUPLICATE_ANALYSIS");
  const sameId = input.property.marketPropertyId && props.resultSnapshot.subject.id === input.property.marketPropertyId;
  const normalize = (value: string) => value.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]/g, "");
  const expected = input.property.normalizedAddress, actual = props.resultSnapshot.subject.normalizedAddress;
  const sameAddress = normalize(expected.address1) === normalize(actual.address1) && normalize(expected.city) === normalize(actual.city) && normalize(expected.state) === normalize(actual.state) && normalize(expected.postalCode) === normalize(actual.postalCode);
  if (!sameId && !sameAddress) reasons.push("PROPERTY_MISMATCH");
  return Object.freeze({ compatible: reasons.length === 0, reasons: Object.freeze(reasons) });
}
