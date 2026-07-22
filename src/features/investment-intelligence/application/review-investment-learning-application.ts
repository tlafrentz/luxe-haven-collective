import {
  Decision,
  DecisionMode,
} from "@/platform/decisions";
import {
  Identifier,
  PlatformError,
} from "@/platform/kernel";
import type {
  LearningInsight,
} from "@/platform/learning";

import type {
  InvestmentLearningApplication,
  InvestmentLearningApplicationMode,
  InvestmentLearningApplicationReviewResult,
  InvestmentLearningApplicationTarget,
  InvestmentLearningReviewDisposition,
  ReviewInvestmentLearningApplicationCommand,
} from "./types/investment-learning-application-types";

export type InvestmentLearningApplicationErrorCode =
  | "INVESTMENT_LEARNING_APPLICATION_LEARNINGS_EMPTY"
  | "INVESTMENT_LEARNING_APPLICATION_DUPLICATE_LEARNING"
  | "INVESTMENT_LEARNING_APPLICATION_LINEAGE_MISMATCH"
  | "INVESTMENT_LEARNING_APPLICATION_SCOPE_EXCEEDS_EVIDENCE"
  | "INVESTMENT_LEARNING_APPLICATION_INVALID_TARGET"
  | "INVESTMENT_LEARNING_APPLICATION_INVALID_MODE"
  | "INVESTMENT_LEARNING_APPLICATION_VALUE_REQUIRED"
  | "INVESTMENT_LEARNING_APPLICATION_VALUE_NOT_ALLOWED"
  | "INVESTMENT_LEARNING_APPLICATION_INVALID_DATES"
  | "INVESTMENT_LEARNING_APPLICATION_CONFLICT"
  | "INVESTMENT_LEARNING_APPLICATION_SUPERSESSION_REQUIRED"
  | "INVESTMENT_LEARNING_APPLICATION_INVALID_SUPERSESSION"
  | "INVESTMENT_LEARNING_APPLICATION_INVALID_ACTOR"
  | "INVESTMENT_LEARNING_APPLICATION_INVALID_CONTEXT"
  | "INVESTMENT_LEARNING_APPLICATION_INVALID_PROPOSAL";

export class InvestmentLearningApplicationError extends PlatformError {
  public constructor(
    code: InvestmentLearningApplicationErrorCode,
    message: string,
  ) {
    super(code, message);
  }
}

/** Reviews a proposed use of immutable Learning and records the review as a Platform Decision. */
export function reviewInvestmentLearningApplication(
  command: ReviewInvestmentLearningApplicationCommand,
): InvestmentLearningApplicationReviewResult {
  validateCommand(command);
  const learnings = resolveLearnings(command);
  validateTargetAndMode(command, learnings);
  const superseded = validateConflicts(command);
  const decision = buildReviewDecision(command, learnings);
  const review = Object.freeze({
    id: command.context.reviewId.trim(),
    proposalId: command.proposal.id.trim(),
    disposition: command.disposition,
    rationale: command.rationale.trim(),
    reviewer: actor(command.reviewer),
    reviewedAt: new Date(command.context.reviewedAt),
    decision,
  });

  if (command.disposition !== "approve") {
    return Object.freeze({ review });
  }

  const application = buildApplication(
    command,
    learnings,
    decision.id.value,
    superseded,
  );
  return Object.freeze({ review, application });
}

function validateCommand(command: ReviewInvestmentLearningApplicationCommand): void {
  const { proposal, context } = command;
  requireText(proposal.id, "INVESTMENT_LEARNING_APPLICATION_INVALID_PROPOSAL", "Proposal ID");
  if (proposal.status !== "proposed") {
    fail("INVESTMENT_LEARNING_APPLICATION_INVALID_PROPOSAL", "Only a proposed Learning Application may be reviewed.");
  }
  requireText(proposal.rationale, "INVESTMENT_LEARNING_APPLICATION_INVALID_PROPOSAL", "Proposal rationale");
  requireText(proposal.evidenceSummary, "INVESTMENT_LEARNING_APPLICATION_INVALID_PROPOSAL", "Proposal evidence summary");
  requireText(proposal.proposedBy.id, "INVESTMENT_LEARNING_APPLICATION_INVALID_ACTOR", "Proposing actor ID");
  requireText(command.reviewer.id, "INVESTMENT_LEARNING_APPLICATION_INVALID_ACTOR", "Reviewing actor ID");
  requireText(command.rationale, "INVESTMENT_LEARNING_APPLICATION_INVALID_PROPOSAL", "Review rationale");
  requireText(context.reviewId, "INVESTMENT_LEARNING_APPLICATION_INVALID_CONTEXT", "Review ID");
  requireText(context.decisionId, "INVESTMENT_LEARNING_APPLICATION_INVALID_CONTEXT", "Decision ID");
  requireText(context.applicationId, "INVESTMENT_LEARNING_APPLICATION_INVALID_CONTEXT", "Application ID");
  validDate(proposal.proposedAt);
  validDate(context.reviewedAt);
  if (context.reviewedAt.getTime() < proposal.proposedAt.getTime()) {
    fail("INVESTMENT_LEARNING_APPLICATION_INVALID_DATES", "Review cannot precede the proposal.");
  }
  if (proposal.effectiveFrom) validDate(proposal.effectiveFrom);
  if (proposal.expiresAt) {
    validDate(proposal.expiresAt);
    const lowerBound = Math.max(
      context.reviewedAt.getTime(),
      proposal.effectiveFrom?.getTime() ?? Number.NEGATIVE_INFINITY,
    );
    if (proposal.expiresAt.getTime() <= lowerBound) {
      fail("INVESTMENT_LEARNING_APPLICATION_INVALID_DATES", "Expiration must follow approval and the effective date.");
    }
  }
}

function resolveLearnings(command: ReviewInvestmentLearningApplicationCommand): readonly LearningInsight[] {
  if (command.proposal.learningInsightIds.length === 0) {
    fail("INVESTMENT_LEARNING_APPLICATION_LEARNINGS_EMPTY", "A Learning Application requires at least one Learning Insight.");
  }
  const ids = command.proposal.learningInsightIds.map((id) => id.trim());
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    fail("INVESTMENT_LEARNING_APPLICATION_DUPLICATE_LEARNING", "Learning Insight IDs must be non-empty and unique.");
  }
  const byId = new Map(command.learnings.map((learning) => [learning.id.value, learning]));
  const resolved = ids.map((id) => byId.get(id));
  if (resolved.some((learning) => !learning) || new Set(command.learnings.map(({ id }) => id.value)).size !== command.learnings.length) {
    fail("INVESTMENT_LEARNING_APPLICATION_LINEAGE_MISMATCH", "The proposal must resolve exactly to the supplied Learning Insights.");
  }
  return Object.freeze(resolved as LearningInsight[]);
}

function validateTargetAndMode(
  command: ReviewInvestmentLearningApplicationCommand,
  learnings: readonly LearningInsight[],
): void {
  const { target, mode, proposedValue } = command.proposal;
  validateTargetText(target);
  const allowed = allowedModes(target.kind);
  if (!allowed.includes(mode)) {
    fail("INVESTMENT_LEARNING_APPLICATION_INVALID_MODE", `Mode ${mode} is not valid for target ${target.kind}.`);
  }
  const valueRequired = mode === "replace-assumption" || mode === "adjust-assumption";
  if (valueRequired && !proposedValue) {
    fail("INVESTMENT_LEARNING_APPLICATION_VALUE_REQUIRED", "Assumption replacement or adjustment requires a proposed value.");
  }
  if (!valueRequired && proposedValue) {
    fail("INVESTMENT_LEARNING_APPLICATION_VALUE_NOT_ALLOWED", "This application mode does not accept a proposed value.");
  }
  if (mode === "add-risk-context" && !command.proposal.riskSeverity) {
    fail("INVESTMENT_LEARNING_APPLICATION_INVALID_PROPOSAL", "Persistent risk context requires an explicit severity.");
  }
  if (mode !== "add-risk-context" && command.proposal.riskSeverity) {
    fail("INVESTMENT_LEARNING_APPLICATION_INVALID_PROPOSAL", "Risk severity is only valid for persistent risk context.");
  }
  if (typeof proposedValue?.value === "number" && !Number.isFinite(proposedValue.value)) {
    fail("INVESTMENT_LEARNING_APPLICATION_VALUE_REQUIRED", "A numeric proposed value must be finite.");
  }
  if (typeof proposedValue?.value === "string" && !proposedValue.value.trim()) {
    fail("INVESTMENT_LEARNING_APPLICATION_VALUE_REQUIRED", "A string proposed value cannot be empty.");
  }

  for (const learning of learnings) {
    if (learning.metadata.capability !== "investment-intelligence") {
      fail("INVESTMENT_LEARNING_APPLICATION_LINEAGE_MISMATCH", "All Learning Insights must originate from Investment Intelligence.");
    }
    if (!scopeSupportsTarget(learning, target)) {
      fail("INVESTMENT_LEARNING_APPLICATION_SCOPE_EXCEEDS_EVIDENCE", "The application target is broader than its Learning evidence.");
    }
  }
}

function buildReviewDecision(
  command: ReviewInvestmentLearningApplicationCommand,
  learnings: readonly LearningInsight[],
) {
  const outcome = dispositionOutcome(command.disposition);
  const confidence = learnings.reduce(
    (lowest, learning) => learning.confidence.score.value < lowest.score.value ? learning.confidence : lowest,
    learnings[0].confidence,
  );
  const subjectId = targetSubject(command.proposal.target);
  const lineage = learnings.flatMap((learning) => [learning.explainability.lineage]);
  return Decision.create({
    id: Identifier.create(command.context.decisionId.trim()),
    type: "investment.learning-application-review",
    outcome,
    context: {
      subjectType: command.proposal.target.kind,
      subjectId,
      scope: command.proposal.target.kind,
      effectiveAt: command.context.reviewedAt,
      attributes: {
        proposalId: command.proposal.id.trim(),
        applicationId: command.context.applicationId.trim(),
      },
    },
    rationale: {
      summary: command.rationale.trim(),
      supportingReasons: [command.proposal.rationale.trim()],
      assumptions: command.proposal.limitations,
      confidence,
    },
    decidedAt: command.context.reviewedAt,
    title: "Investment Learning application review",
    summary: `Investment Learning application ${outcome}.`,
    mode: dispositionMode(command.disposition),
    confidence,
    recommendationIds: uniqueIdentifiers(lineage.flatMap(({ recommendationIds }) => recommendationIds)),
    evaluationIds: uniqueIdentifiers(lineage.flatMap(({ evaluationIds }) => evaluationIds)),
    claimIds: uniqueIdentifiers(lineage.flatMap(({ claimIds }) => claimIds)),
    evidenceIds: uniqueIdentifiers(lineage.flatMap(({ evidenceIds }) => evidenceIds)),
    observationIds: uniqueIdentifiers(lineage.flatMap(({ observationIds }) => observationIds)),
    metadata: {
      capability: "investment-intelligence",
      governanceBoundary: "learning-application",
      proposalId: command.proposal.id.trim(),
      applicationId: command.context.applicationId.trim(),
      learningInsightIds: learnings.map(({ id }) => id.value),
      disposition: command.disposition,
      proposedByActorId: command.proposal.proposedBy.id.trim(),
      reviewerActorId: command.reviewer.id.trim(),
      derivedByActorIds: uniqueStrings(learnings.map(({ metadata }) => String(metadata.derivedByActorId ?? "")).filter(Boolean)),
    },
  });
}

function buildApplication(
  command: ReviewInvestmentLearningApplicationCommand,
  learnings: readonly LearningInsight[],
  decisionId: string,
  superseded?: InvestmentLearningApplication,
): InvestmentLearningApplication {
  const sourceOutcomeIds = uniqueStrings(learnings.flatMap(({ explainability }) => explainability.supportingOutcomeIds.map(({ value }) => value)));
  return Object.freeze({
    id: command.context.applicationId.trim(),
    version: (superseded?.version ?? 0) + 1,
    status: "approved" as const,
    approvalDecisionId: decisionId,
    learningInsightIds: Object.freeze(learnings.map(({ id }) => id.value)),
    target: Object.freeze({ ...command.proposal.target }),
    mode: command.proposal.mode,
    ...(command.proposal.previousValue ? { previousValue: Object.freeze({ ...command.proposal.previousValue }) } : {}),
    ...(command.proposal.proposedValue ? { appliedValue: Object.freeze({ ...command.proposal.proposedValue }) } : {}),
    ...(command.proposal.riskSeverity ? { riskSeverity: command.proposal.riskSeverity } : {}),
    rationale: command.rationale.trim(),
    limitations: Object.freeze(uniqueStrings(command.proposal.limitations)),
    approvedBy: actor(command.reviewer),
    approvedAt: new Date(command.context.reviewedAt),
    ...(command.proposal.effectiveFrom ? { effectiveFrom: new Date(command.proposal.effectiveFrom) } : {}),
    ...(command.proposal.expiresAt ? { expiresAt: new Date(command.proposal.expiresAt) } : {}),
    sourceSubjectIds: Object.freeze(uniqueMetadata(learnings, "subjectId")),
    sourceOutcomeIds: Object.freeze(sourceOutcomeIds),
    sourceInvestmentRunIds: Object.freeze(uniqueMetadata(learnings, "investmentRunId")),
    sourceAcquisitionTypes: Object.freeze(uniqueAcquisitionTypes(learnings)),
    ...(superseded ? { supersedesApplicationId: superseded.id } : {}),
  });
}

function validateConflicts(command: ReviewInvestmentLearningApplicationCommand): InvestmentLearningApplication | undefined {
  if (command.disposition !== "approve") return undefined;
  const active = (command.context.existingApplications ?? []).filter((application) =>
    (application.status === "approved" || application.status === "applied") && sameTarget(application.target, command.proposal.target),
  );
  if (active.length > 1) {
    fail("INVESTMENT_LEARNING_APPLICATION_CONFLICT", "Multiple active Learning Applications already control this target.");
  }
  const supersedesId = command.proposal.supersedesApplicationId?.trim();
  if (active.length === 1 && !supersedesId) {
    fail("INVESTMENT_LEARNING_APPLICATION_SUPERSESSION_REQUIRED", "An active Learning Application must be explicitly superseded.");
  }
  if (supersedesId) {
    const superseded = (command.context.existingApplications ?? []).find(({ id }) => id === supersedesId);
    if (!superseded || !sameTarget(superseded.target, command.proposal.target) || !active.includes(superseded)) {
      fail("INVESTMENT_LEARNING_APPLICATION_INVALID_SUPERSESSION", "The superseded application must be active and control the same target.");
    }
    return superseded;
  }
  return undefined;
}

function allowedModes(kind: InvestmentLearningApplicationTarget["kind"]): readonly InvestmentLearningApplicationMode[] {
  switch (kind) {
    case "subject-assumption": return ["replace-assumption", "adjust-assumption", "add-constraint", "resolve-data-gap", "add-risk-context"];
    case "subject-strategy": return ["add-constraint", "resolve-data-gap", "add-risk-context"];
    case "market-assumption-candidate": return ["calibration-candidate", "policy-review-candidate"];
    case "execution-policy-candidate": return ["policy-review-candidate"];
    case "confidence-calibration-candidate": return ["calibration-candidate"];
  }
}

function scopeSupportsTarget(learning: LearningInsight, target: InvestmentLearningApplicationTarget): boolean {
  const scopeKind = learning.metadata.scopeKind;
  const scope = learning.metadata.scope;
  switch (target.kind) {
    case "subject-assumption":
    case "subject-strategy": return scopeKind === "subject" && scope === target.subjectId;
    case "market-assumption-candidate": return scopeKind === "market" && scope === target.marketId;
    case "execution-policy-candidate": return scopeKind === "strategy" && scope === target.acquisitionType;
    case "confidence-calibration-candidate": return scopeKind === "strategy" || scopeKind === "assumption-policy";
  }
}

function validateTargetText(target: InvestmentLearningApplicationTarget): void {
  const values = target.kind === "subject-assumption" ? [target.subjectId, target.assumptionKey]
    : target.kind === "subject-strategy" ? [target.subjectId, target.acquisitionType]
      : target.kind === "market-assumption-candidate" ? [target.marketId, target.assumptionKey]
        : target.kind === "execution-policy-candidate" ? [target.acquisitionType, target.policyKey]
          : [target.capability, target.dimension];
  if (values.some((value) => !String(value).trim())) {
    fail("INVESTMENT_LEARNING_APPLICATION_INVALID_TARGET", "Learning Application target fields cannot be empty.");
  }
}

function sameTarget(first: InvestmentLearningApplicationTarget, second: InvestmentLearningApplicationTarget): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function targetSubject(target: InvestmentLearningApplicationTarget): string {
  switch (target.kind) {
    case "subject-assumption":
    case "subject-strategy": return target.subjectId;
    case "market-assumption-candidate": return target.marketId;
    case "execution-policy-candidate": return target.acquisitionType;
    case "confidence-calibration-candidate": return target.capability;
  }
}

function dispositionOutcome(disposition: InvestmentLearningReviewDisposition) {
  return disposition === "approve" ? "approved" as const : disposition === "reject" ? "rejected" as const : "deferred" as const;
}

function dispositionMode(disposition: InvestmentLearningReviewDisposition): DecisionMode {
  return disposition === "approve" ? DecisionMode.HUMAN_APPROVED : disposition === "reject" ? DecisionMode.REJECTED : DecisionMode.DEFERRED;
}

function uniqueIdentifiers<T extends Identifier>(values: readonly T[]): readonly T[] {
  return [...new Map(values.map((value) => [value.value, value])).values()];
}

function uniqueMetadata(learnings: readonly LearningInsight[], key: string): readonly string[] {
  return uniqueStrings(learnings.map(({ metadata }) => String(metadata[key] ?? "")).filter(Boolean));
}

function uniqueAcquisitionTypes(learnings: readonly LearningInsight[]) {
  return uniqueMetadata(learnings, "acquisitionType") as InvestmentLearningApplication["sourceAcquisitionTypes"];
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function actor(value: { id: string; displayName?: string }) {
  return Object.freeze({ id: value.id.trim(), ...(value.displayName?.trim() ? { displayName: value.displayName.trim() } : {}) });
}

function validDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail("INVESTMENT_LEARNING_APPLICATION_INVALID_DATES", "Learning Application dates must be valid.");
  }
}

function requireText(value: string, code: InvestmentLearningApplicationErrorCode, label: string): string {
  const normalized = value.trim();
  if (!normalized) fail(code, `${label} cannot be empty.`);
  return normalized;
}

function fail(code: InvestmentLearningApplicationErrorCode, message: string): never {
  throw new InvestmentLearningApplicationError(code, message);
}
