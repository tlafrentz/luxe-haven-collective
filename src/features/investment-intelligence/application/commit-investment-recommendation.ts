import {
  Decision,
  DecisionMode,
} from "@/platform/decisions";
import {
  Identifier,
  PlatformError,
} from "@/platform/kernel";

import type {
  CommitInvestmentRecommendationCommand,
  InvestmentCommitmentDecisionOutcome,
  InvestmentCommitmentResponse,
  InvestmentCommitmentResult,
} from "./types/investment-commitment-types";

export type InvestmentCommitmentErrorCode =
  | "INVESTMENT_COMMITMENT_RECOMMENDATION_NOT_FOUND"
  | "INVESTMENT_COMMITMENT_ROUTE_MISMATCH"
  | "INVESTMENT_COMMITMENT_SUBJECT_MISMATCH"
  | "INVESTMENT_COMMITMENT_RUN_MISMATCH"
  | "INVESTMENT_COMMITMENT_INVALID_RATIONALE"
  | "INVESTMENT_COMMITMENT_INVALID_ACTOR"
  | "INVESTMENT_COMMITMENT_INVALID_CONTEXT"
  | "INVESTMENT_COMMITMENT_UNSUPPORTED_RESPONSE";

export class InvestmentCommitmentError extends PlatformError {
  public constructor(
    code: InvestmentCommitmentErrorCode,
    message: string,
  ) {
    super(code, message);
  }
}

/** Records an explicit operator response to one Investment recommendation. */
export function commitInvestmentRecommendation(
  command: CommitInvestmentRecommendationCommand,
): InvestmentCommitmentResult {
  const {
    lifecycleResult,
    platformAnalysis,
  } = command;

  if (
    lifecycleResult.acquisitionType !==
    platformAnalysis.acquisitionType
  ) {
    throw commitmentError(
      "INVESTMENT_COMMITMENT_ROUTE_MISMATCH",
      "Investment lifecycle and Platform analysis routes do not match.",
    );
  }

  const recommendationMatches =
    platformAnalysis.recommendations
      .toArray()
      .filter(
        ({ id }) =>
          id.value ===
          command.recommendationId,
      );

  if (recommendationMatches.length !== 1) {
    throw commitmentError(
      "INVESTMENT_COMMITMENT_RECOMMENDATION_NOT_FOUND",
      "The selected Investment recommendation was not found exactly once.",
    );
  }

  const recommendation =
    recommendationMatches[0];
  const subjectId =
    lifecycleResult.analysis.property.id;
  const recommendationSubject =
    recommendation.metadata.propertyId;
  const recommendationRoute =
    recommendation.metadata.acquisitionType;
  const recommendationRunId =
    recommendation.metadata.runId;

  if (
    recommendation.category !==
      "investment-acquisition" ||
    recommendationRoute !==
      lifecycleResult.acquisitionType
  ) {
    throw commitmentError(
      "INVESTMENT_COMMITMENT_ROUTE_MISMATCH",
      "The selected recommendation is not from the supplied Investment route.",
    );
  }

  if (
    recommendationSubject !== subjectId
  ) {
    throw commitmentError(
      "INVESTMENT_COMMITMENT_SUBJECT_MISMATCH",
      "The selected recommendation does not belong to the supplied Investment subject.",
    );
  }

  if (
    recommendationRunId !==
    platformAnalysis.lineage.runId
  ) {
    throw commitmentError(
      "INVESTMENT_COMMITMENT_RUN_MISMATCH",
      "The selected recommendation does not belong to the supplied Platform run.",
    );
  }

  const actorId = requireText(
    command.actor.id,
    "INVESTMENT_COMMITMENT_INVALID_ACTOR",
    "Investment commitment actor ID cannot be empty.",
  );
  const rationale = normalizeRationale(
    command.rationale,
  );
  const decisionId = requireText(
    command.context.decisionId,
    "INVESTMENT_COMMITMENT_INVALID_CONTEXT",
    "Investment commitment Decision ID cannot be empty.",
  );
  if (
    !(command.context.decidedAt instanceof Date) ||
    Number.isNaN(
      command.context.decidedAt.getTime(),
    )
  ) {
    throw commitmentError(
      "INVESTMENT_COMMITMENT_INVALID_CONTEXT",
      "Investment commitment timestamp must be valid.",
    );
  }
  const outcome = responseOutcome(
    command.response,
  );
  const mode = responseMode(
    command.response,
  );

  const decision = Decision.create({
    id: Identifier.create(
      decisionId,
    ),
    type: "investment.acquisition",
    outcome,
    context: {
      subjectType: "property",
      subjectId,
      scope: lifecycleResult.acquisitionType,
      effectiveAt:
        command.context.decidedAt,
      attributes: {
        platformRunId:
          platformAnalysis.lineage.runId,
        recommendationId:
          recommendation.id.value,
      },
    },
    rationale: {
      summary:
        rationale ??
        `The operator chose to ${command.response} the Investment recommendation.`,
      supportingReasons: rationale
        ? [rationale]
        : [],
      confidence:
        recommendation.confidence,
    },
    decidedAt: command.context.decidedAt,
    title: "Investment commitment decision",
    summary:
      `Investment recommendation ${outcome}.`,
    mode,
    priority: recommendation.priority,
    confidence: recommendation.confidence,
    recommendationIds: [recommendation.id],
    evaluationIds:
      recommendation.evaluationIds,
    claimIds: recommendation.claimIds,
    evidenceIds:
      recommendation.evidenceIds,
    observationIds:
      recommendation.observationIds,
    metadata: {
      capability:
        "investment-intelligence",
      acquisitionType:
        lifecycleResult.acquisitionType,
      propertyId: subjectId,
      platformRunId:
        platformAnalysis.lineage.runId,
      recommendationId:
        recommendation.id.value,
      response: command.response,
      actorId,
      ...(command.actor.displayName?.trim()
        ? {
            actorDisplayName:
              command.actor.displayName.trim(),
          }
        : {}),
      ...(rationale
        ? { rationaleSource: "operator" }
        : {}),
      investmentScore:
        platformAnalysis.scores.overall
          .value,
    },
  });

  return {
    acquisitionType:
      lifecycleResult.acquisitionType,
    response: command.response,
    platformRunId:
      platformAnalysis.lineage.runId,
    recommendationId:
      recommendation.id.value,
    recommendation,
    decision,
  };
}

function responseOutcome(
  response: InvestmentCommitmentResponse,
): InvestmentCommitmentDecisionOutcome {
  switch (response) {
    case "accept":
      return "accepted";
    case "reject":
      return "rejected";
    case "defer":
      return "deferred";
    default:
      return assertUnsupportedResponse(response);
  }
}

function responseMode(
  response: InvestmentCommitmentResponse,
): DecisionMode {
  switch (response) {
    case "accept":
      return DecisionMode.HUMAN_APPROVED;
    case "reject":
      return DecisionMode.REJECTED;
    case "defer":
      return DecisionMode.DEFERRED;
    default:
      return assertUnsupportedResponse(response);
  }
}

function assertUnsupportedResponse(
  response: never,
): never {
  throw commitmentError(
    "INVESTMENT_COMMITMENT_UNSUPPORTED_RESPONSE",
    `Unsupported Investment commitment response: ${String(response)}.`,
  );
}

function normalizeRationale(
  rationale: string | undefined,
): string | undefined {
  if (rationale === undefined) {
    return undefined;
  }

  const normalized = rationale.trim();
  if (!normalized) {
    throw commitmentError(
      "INVESTMENT_COMMITMENT_INVALID_RATIONALE",
      "Investment commitment rationale cannot be empty when supplied.",
    );
  }

  return normalized;
}

function requireText(
  value: string,
  code: InvestmentCommitmentErrorCode,
  message: string,
): string {
  const normalized = value.trim();
  if (!normalized) {
    throw commitmentError(code, message);
  }
  return normalized;
}

function commitmentError(
  code: InvestmentCommitmentErrorCode,
  message: string,
): InvestmentCommitmentError {
  return new InvestmentCommitmentError(
    code,
    message,
  );
}
