import {
  LearningInsight,
  createLearningInsightId,
} from "@/platform/learning";
import {
  normalizeOutcomeLineage,
} from "@/platform/outcomes";
import {
  ConfidenceAssessment,
  ConfidenceScore,
} from "@/platform/scoring";

import type {
  Outcome,
  OutcomeLineage,
} from "@/platform/outcomes";
import type {
  DeriveInvestmentLearningCommand,
  InvestmentLearningCandidate,
} from "../types";

/** The sole Investment adapter that creates canonical Platform Learning artifacts. */
export function mapInvestmentLearningToPlatform(
  candidate: InvestmentLearningCandidate,
  outcomes: readonly Outcome[],
  command: DeriveInvestmentLearningCommand,
): LearningInsight {
  const supportingOutcomes =
    candidate.outcomeIds.map((id) => {
      const outcome = outcomes.find(
        (value) => value.id.value === id,
      );
      if (!outcome) {
        throw new TypeError(
          `Learning candidate references unknown Outcome: ${id}.`,
        );
      }
      return outcome;
    });
  const learningId =
    command.context.learningIds[
      candidate.key
    ];

  return LearningInsight.create({
    id: createLearningInsightId(learningId),
    title: candidate.title,
    summary: candidate.summary,
    type: learningInsightType(candidate),
    confidence: learningConfidence(candidate),
    explainability: {
      supportingOutcomeIds:
        supportingOutcomes.map(
          ({ id }) => id,
        ),
      supportingIntelligenceIds: [],
      lineage: mergeOutcomeLineage(
        supportingOutcomes,
      ),
      assumptions:
        candidate.assumptionReferences.length > 0
          ? candidate.assumptionReferences
          : [
              `The recorded Outcome for ${candidate.key} accurately represents the completed Investment work.`,
            ],
      rationale: [
        candidate.confidenceImpact.rationale,
        ...(candidate.policyImpact
          ? [candidate.policyImpact.rationale]
          : []),
      ],
    },
    metadata: {
      capability:
        "investment-intelligence",
      learningRunId:
        command.context.learningRunId,
      derivedAt:
        command.context.derivedAt.toISOString(),
      derivedByActorId: command.actor.id,
      ...(command.actor.displayName?.trim()
        ? {
            derivedByActorDisplayName:
              command.actor.displayName.trim(),
          }
        : {}),
      learningKind: candidate.kind,
      scopeKind: candidate.scope.kind,
      scope: serializeScope(candidate.scope),
      confidenceImpactDirection:
        candidate.confidenceImpact.direction,
      confidenceImpactMagnitude:
        candidate.confidenceImpact.direction ===
        "none"
          ? "none"
          : candidate.confidenceImpact.magnitude,
      policyImpactTarget:
        candidate.policyImpact?.target ?? null,
      policyImpactDisposition:
        candidate.policyImpact?.disposition ??
        null,
      sourceActorIds:
        candidate.sourceActorIds,
      subjectId:
        command.priorContext.lifecycleResult
          .analysis.property.id,
      acquisitionType:
        command.priorContext.lifecycleResult
          .acquisitionType,
      investmentRunId:
        command.priorContext.platformAnalysis
          .lineage.runId,
      decisionId:
        command.priorContext.decision.id.value,
      recommendationId:
        command.priorContext.decision
          .recommendationIds[0].value,
      executionPlanId:
        command.priorContext.planId,
    },
  });
}

function learningInsightType(
  candidate: InvestmentLearningCandidate,
) {
  switch (candidate.kind) {
    case "confirmed":
      return "successful-pattern" as const;
    case "contradicted":
      return "unsuccessful-pattern" as const;
    case "refined":
      return "calibration" as const;
    case "unresolved":
      return "other" as const;
  }
}

function learningConfidence(
  candidate: InvestmentLearningCandidate,
): ConfidenceAssessment {
  const score =
    candidate.kind === "unresolved"
      ? 50
      : candidate.assumptionReferences.length > 0
        ? 90
        : 75;
  return ConfidenceAssessment.create({
    score: ConfidenceScore.create(score),
    rationale: [
      `Confidence reflects the explicit ${candidate.kind} Outcome interpretation; it does not replace Investment analysis confidence.`,
    ],
  });
}

function mergeOutcomeLineage(
  outcomes: readonly Outcome[],
): OutcomeLineage {
  const keys = Object.keys(
    outcomes[0].lineage,
  ) as (keyof OutcomeLineage)[];
  return normalizeOutcomeLineage(
    Object.fromEntries(
      keys.map((key) => [
        key,
        outcomes.flatMap(
          ({ lineage }) => lineage[key],
        ),
      ]),
    ) as unknown as OutcomeLineage,
  );
}

function serializeScope(
  scope: InvestmentLearningCandidate["scope"],
): string {
  switch (scope.kind) {
    case "subject":
      return scope.subjectId;
    case "market":
      return scope.marketId;
    case "strategy":
      return scope.acquisitionType;
    case "assumption-policy":
      return scope.assumptionKey;
  }
}
