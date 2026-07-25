import { Decision, DecisionMode } from "@/platform/decisions";
import { ConfidenceAssessment, ConfidenceScore } from "@/platform/scoring";
import { RecommendationPriority } from "@/platform/recommendations";
import type { WorkspaceRole } from "@/features/workspace";
import type { FindingEvidence } from "../findings";
import type {
  PortfolioDecisionCandidate, DecisionCommand, DecisionExecutionPlan,
  DecisionMeasurementPlan, DecisionRepository, ExpectedOutcome,
  PortfolioStrategicDecision,
} from "./contracts";
import { canApprovePortfolioDecision } from "./policies";

export class PortfolioDecisionError extends Error {
  constructor(public readonly code:
    | "permission" | "evidence" | "conflict" | "expired" | "concurrency"
    | "invalid-command" | "unavailable", message: string) {
    super(message);
    this.name = "PortfolioDecisionError";
  }
}

export function createPortfolioDecision(input: Readonly<{
  candidate: PortfolioDecisionCandidate; ownerProfileId: string;
  evidence: readonly FindingEvidence[]; now: string;
}>): PortfolioStrategicDecision {
  return Object.freeze({
    decisionId: `portfolio-decision:${input.candidate.id}`,
    workspaceId: input.candidate.workspaceId,
    decisionType: input.candidate.decisionType,
    question: decisionQuestion(input.candidate),
    sourceFindingIds: input.candidate.sourceFindingIds,
    affectedPropertyIds: input.candidate.affectedPropertyIds,
    recommendationId: input.candidate.id,
    alternatives: input.candidate.alternatives,
    recommendedAlternativeId: input.candidate.recommendedAlternativeId,
    rationale: "Awaiting authorized human review.",
    evidence: input.evidence,
    evidenceVersion: input.candidate.evidenceVersion,
    confidence: input.candidate.confidence,
    assumptions: input.candidate.assumptions,
    dependencies: input.candidate.dependencies,
    expectedOutcomes: expectedOutcomes(input.candidate, input.evidence),
    approvedResources: [],
    status: "ready-for-review",
    ownerProfileId: input.ownerProfileId,
    revision: 1,
    createdAt: input.now,
    updatedAt: input.now,
    activity: [{
      id: `${input.candidate.id}:created`, operation: "decision-created",
      actorProfileId: input.ownerProfileId, occurredAt: input.now,
      safeSummary: "Portfolio decision created from an evidence-backed recommendation.",
    }],
  });
}

export async function applyPortfolioDecisionCommand(
  repository: DecisionRepository,
  decision: PortfolioStrategicDecision,
  candidate: PortfolioDecisionCandidate,
  command: DecisionCommand,
): Promise<PortfolioStrategicDecision> {
  if (decision.activity.some(({ id }) => id.endsWith(`:${command.commandId}`))) return decision;
  if (command.expectedRevision !== decision.revision) {
    throw new PortfolioDecisionError("concurrency", "Decision updated by another user. Reload before continuing.");
  }
  if (new Date(candidate.expiresAt).getTime() <= new Date(command.occurredAt).getTime()) {
    throw new PortfolioDecisionError("expired", "This recommendation has expired. Generate a current recommendation.");
  }
  const selected = command.selectedAlternativeId ?? decision.selectedAlternativeId;
  if (selected && !decision.alternatives.some(({ id }) => id === selected)) {
    throw new PortfolioDecisionError("invalid-command", "The selected alternative was not part of the reviewed decision.");
  }
  const next = transition(decision, candidate, command, selected);
  return repository.save(next, decision.revision, command.commandId);
}

function transition(
  decision: PortfolioStrategicDecision,
  candidate: PortfolioDecisionCandidate,
  command: DecisionCommand,
  selected: string | undefined,
): PortfolioStrategicDecision {
  if (command.type === "approve") validateApproval(candidate, decision, command.actorRole, selected, command);
  const status = command.type === "start-review" ? "under-review"
    : command.type === "approve" ? "approved"
      : command.type === "reject" ? "rejected"
        : command.type === "defer" || command.type === "request-evidence" ? "deferred"
          : "superseded";
  const approved = command.type === "approve";
  const revision = decision.revision + 1;
  return Object.freeze({
    ...decision, status, revision, updatedAt: command.occurredAt,
    ...(selected ? { selectedAlternativeId: selected } : {}),
    ...(command.rationale ? { rationale: command.rationale } : {}),
    ...(command.reviewAt ? { reviewAt: command.reviewAt } : {}),
    ...(approved ? {
      decidedByProfileId: command.actorProfileId, decidedAt: command.occurredAt,
      canonicalDecisionId: `decision-${decision.decisionId}`,
      approvedResources: decision.alternatives.find(({ id }) => id === selected)!.requiredResources,
    } : {}),
    activity: [...decision.activity, {
      id: `${decision.decisionId}:${revision}:${command.commandId}`,
      operation: command.type, actorProfileId: command.actorProfileId,
      occurredAt: command.occurredAt,
      safeSummary: safeSummary(command.type),
    }],
  });
}

function validateApproval(
  candidate: PortfolioDecisionCandidate,
  decision: PortfolioStrategicDecision,
  role: WorkspaceRole,
  selected: string | undefined,
  command: DecisionCommand,
) {
  if (!canApprovePortfolioDecision(role, candidate)) throw new PortfolioDecisionError("permission", "Only an authorized workspace owner may approve this portfolio decision.");
  if (!selected) throw new PortfolioDecisionError("invalid-command", "Select a reviewed alternative before approval.");
  if (!command.rationale?.trim()) throw new PortfolioDecisionError("invalid-command", "Approval rationale is required.");
  if (!command.reviewAt) throw new PortfolioDecisionError("invalid-command", "A review date is required.");
  if (decision.assumptions.some(({ material, status }) => material && (status === "invalidated" || status === "expired"))) {
    throw new PortfolioDecisionError("evidence", "A material assumption is invalid or expired.");
  }
  if (decision.dependencies.some(({ critical, status }) => critical && status === "unresolved")) {
    throw new PortfolioDecisionError("conflict", "A critical dependency remains unresolved.");
  }
}

export function toCanonicalPlatformDecision(decision: PortfolioStrategicDecision) {
  if (decision.status !== "approved" || !decision.selectedAlternativeId || !decision.decidedAt) {
    throw new PortfolioDecisionError("invalid-command", "Only an approved portfolio decision can become a canonical Platform Decision.");
  }
  const confidenceScore = decision.confidence === "very-high" ? 95 : decision.confidence === "high" ? 85
    : decision.confidence === "moderate" ? 65 : decision.confidence === "low" ? 40 : 15;
  return Decision.create({
    type: decision.decisionType,
    outcome: decision.selectedAlternativeId,
    options: decision.alternatives.map((alternative, index) => ({
      key: alternative.id, label: alternative.label, outcome: alternative.id,
      rank: index + 1, score: 0, summary: alternative.description,
    })),
    context: {
      subjectType: "portfolio", subjectId: decision.workspaceId,
      scope: decision.sourceFindingIds.join(","), effectiveAt: new Date(decision.decidedAt),
      attributes: { evidenceVersion: decision.evidenceVersion, portfolioDecisionId: decision.decisionId },
    },
    rationale: {
      summary: decision.rationale,
      supportingReasons: decision.evidence.map(({ statement }) => statement),
      assumptions: decision.assumptions.map(({ statement }) => statement),
      risks: decision.alternatives.find(({ id }) => id === decision.selectedAlternativeId)?.risks.map(({ description }) => description),
    },
    decidedAt: new Date(decision.decidedAt), title: decision.question,
    summary: decision.rationale, mode: DecisionMode.HUMAN_APPROVED,
    priority: RecommendationPriority.HIGH,
    confidence: ConfidenceAssessment.create({
      score: ConfidenceScore.create(confidenceScore), level: decision.confidence,
      rationale: ["Preserved from the reviewed portfolio recommendation."],
    }),
    metadata: {
      portfolioDecisionId: decision.decisionId, evidenceVersion: decision.evidenceVersion,
      ownerProfileId: decision.ownerProfileId, reviewAt: decision.reviewAt ?? "",
    },
  });
}

export function buildDecisionExecutionPlan(decision: PortfolioStrategicDecision): DecisionExecutionPlan {
  if (decision.status !== "approved") throw new PortfolioDecisionError("invalid-command", "Execution plans require an approved decision.");
  const titles = ["Validate implementation requirements", "Confirm resources and ownership", "Implement selected alternative", "Measure results and prepare review"];
  return {
    decisionId: decision.decisionId, editable: true,
    actions: titles.map((title, index) => ({
      id: `${decision.decisionId}:action:${index + 1}`, title,
      type: index === 3 ? "measurement" : index === 0 ? "investigation" : "implementation",
      decisionId: decision.decisionId, sourceFindingIds: decision.sourceFindingIds,
    })),
  };
}

export function createDecisionMeasurementPlan(decision: PortfolioStrategicDecision): DecisionMeasurementPlan {
  if (decision.status !== "approved" || !decision.reviewAt) {
    throw new PortfolioDecisionError("invalid-command", "An approved decision and review date are required.");
  }
  return { decisionId: decision.decisionId, outcomes: decision.expectedOutcomes, ownerProfileId: decision.ownerProfileId, reviewAt: decision.reviewAt };
}

function expectedOutcomes(candidate: PortfolioDecisionCandidate, evidence: readonly FindingEvidence[]): readonly ExpectedOutcome[] {
  return candidate.expectedImpact.dimensions.map((item) => ({
    metric: item.dimension,
    ...(item.value.type === "range" ? { target: { minimum: item.value.minimum, maximum: item.value.maximum, unit: item.value.unit } } : {}),
    ...(item.value.type === "directional" ? { direction: item.value.direction } : {}),
    measurementWindow: candidate.expectedImpact.measurementPeriod ?? { minimumDays: 30, maximumDays: 90 },
    confidence: candidate.confidence, evidence,
  }));
}
function decisionQuestion(candidate: PortfolioDecisionCandidate): string {
  return `Should the portfolio approve “${candidate.alternatives.find(({ id }) => id === candidate.recommendedAlternativeId)?.label ?? candidate.title}”?`;
}
function safeSummary(type: DecisionCommand["type"]): string {
  return type === "approve" ? "Portfolio decision approved by an authorized decision-maker."
    : type === "reject" ? "Portfolio decision rejected."
      : type === "defer" ? "Portfolio decision deferred."
        : type === "request-evidence" ? "Additional evidence requested."
          : type === "start-review" ? "Portfolio decision review started."
            : "Portfolio decision superseded.";
}
