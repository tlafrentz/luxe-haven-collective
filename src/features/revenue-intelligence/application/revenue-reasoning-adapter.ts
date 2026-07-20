import { Claim, ClaimCollection, createClaimId } from "@/platform/claims";
import { Evaluation, EvaluationCollection, EvaluationDisposition, createEvaluationId } from "@/platform/evaluations";
import { Evidence, EvidenceCollection, EvidenceDirection, EvidenceStrength, createEvidenceId } from "@/platform/evidence";
import { ObservationCollection } from "@/platform/observations";
import { Recommendation, RecommendationCollection, RecommendationPriority, createRecommendationId } from "@/platform/recommendations";
import { ConfidenceAssessment, ConfidenceLevel, ConfidenceScore } from "@/platform/scoring";
import type { OpportunityReport, OpportunityConfidence, OpportunitySeverity, RevenueOpportunity } from "../types";
import type { RevenueReasoningArtifacts } from "../domain/revenue-reasoning-artifacts";
import { mapOpportunityEvidence } from "./map-opportunity-evidence";

/** Converts revenue detector policy output into the canonical reasoning lifecycle. */
export function toRevenueReasoningArtifacts(report: OpportunityReport): RevenueReasoningArtifacts {
  const observations = [], evidence = [], claims = [], evaluations = [], recommendations = [];
  for (const opportunity of report.opportunities) {
    const mappedObservations = mapOpportunityEvidence(opportunity, new Date(report.generatedAt));
    observations.push(...mappedObservations);
    const mappedEvidence = mappedObservations.map((observation, index) => Evidence.create({
      id: createEvidenceId(`${opportunity.id}-evidence-${index + 1}`), type: `revenue.${opportunity.type}`,
      subject: subject(opportunity), title: opportunity.evidence[index].label, explanation: opportunity.summary,
      direction: EvidenceDirection.SUPPORTING, strength: strength(opportunity.severity),
      source: { capability: "revenue-intelligence", name: opportunity.detectorId }, observationIds: [observation.id],
      createdAt: new Date(opportunity.detectedAt), metadata: { opportunityId: opportunity.id, evidenceKey: opportunity.evidence[index].key },
    }));
    evidence.push(...mappedEvidence);
    const claim = Claim.create({ id: createClaimId(`${opportunity.id}-claim`), type: `revenue.${opportunity.type}`,
      subject: subject(opportunity), statement: opportunity.summary, source: { capability: "revenue-intelligence", name: opportunity.detectorId },
      evidenceIds: mappedEvidence.map((item) => item.id), createdAt: new Date(opportunity.detectedAt), metadata: { opportunityId: opportunity.id } });
    claims.push(claim);
    const confidence = confidenceAssessment(opportunity.confidence, opportunity.evidence.length);
    const evaluation = Evaluation.create({ id: createEvaluationId(`${opportunity.id}-evaluation`), type: "revenue.opportunity-assessment",
      claimId: claim.id, disposition: EvaluationDisposition.SUPPORTED, summary: `Revenue detector ${opportunity.detectorId} supports this opportunity.`,
      confidence, evidenceIds: mappedEvidence.map((item) => item.id), source: { capability: "revenue-intelligence", name: opportunity.detectorId },
      evaluatedAt: new Date(opportunity.detectedAt), metadata: { opportunityId: opportunity.id, severity: opportunity.severity } });
    evaluations.push(evaluation);
    recommendations.push(Recommendation.create({ id: createRecommendationId(`${opportunity.id}-recommendation`), summary: opportunity.action.summary,
      rationale: [opportunity.summary, opportunity.impact?.basis ?? "Revenue detector policy criteria were satisfied."],
      priority: priority(opportunity.severity), category: opportunity.category, confidence, evaluationIds: [evaluation.id],
      evidenceIds: mappedEvidence.map((item) => item.id), claimIds: [claim.id], observationIds: mappedObservations.map((item) => item.id),
      metadata: { opportunityId: opportunity.id, detectorId: opportunity.detectorId, proposedActionType: opportunity.action.type } }));
  }
  return { observations: ObservationCollection.create(observations), evidence: EvidenceCollection.create(evidence), claims: ClaimCollection.create(claims),
    evaluations: EvaluationCollection.create(evaluations), recommendations: RecommendationCollection.create(recommendations) };
}

function subject(value: RevenueOpportunity) { return value.propertyId ? { type: "property", id: value.propertyId } : { type: "portfolio", id: "portfolio" }; }
function strength(value: OpportunitySeverity): EvidenceStrength { return value === "high" ? EvidenceStrength.STRONG : value === "medium" ? EvidenceStrength.MODERATE : EvidenceStrength.WEAK; }
function priority(value: OpportunitySeverity): RecommendationPriority { return value === "high" ? RecommendationPriority.HIGH : value === "medium" ? RecommendationPriority.MEDIUM : RecommendationPriority.LOW; }
function confidenceAssessment(value: OpportunityConfidence, evidenceCount: number): ConfidenceAssessment {
  const score = value === "high" ? 85 : value === "medium" ? 60 : 35;
  const level = value === "high" ? ConfidenceLevel.HIGH : value === "medium" ? ConfidenceLevel.MODERATE : ConfidenceLevel.LOW;
  return ConfidenceAssessment.create({ score: ConfidenceScore.create(score), level, rationale: [`Detector confidence is ${value}.`, `${evidenceCount} supporting evidence item(s).`] });
}
