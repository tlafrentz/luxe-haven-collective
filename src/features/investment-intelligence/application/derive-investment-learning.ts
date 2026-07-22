import {
  PlatformError,
} from "@/platform/kernel";

import {
  AcquisitionType,
} from "../domain";
import {
  mapInvestmentLearningToPlatform,
} from "./adapters/map-investment-learning-to-platform";

import type {
  Outcome,
} from "@/platform/outcomes";
import type {
  DeriveInvestmentLearningCommand,
  InvestmentConfidenceImpact,
  InvestmentLearningCandidate,
  InvestmentLearningKind,
  InvestmentLearningResult,
  InvestmentPolicyImpact,
  InvestmentPolicyImpactTarget,
} from "./types/investment-learning-types";

const CONFIRMED_VARIANCE_RATIO = 0.05;
const REFINED_VARIANCE_RATIO = 0.2;
const MAJOR_VARIANCE_RATIO = 0.5;

export type InvestmentLearningErrorCode =
  | "INVESTMENT_LEARNING_OUTCOMES_EMPTY"
  | "INVESTMENT_LEARNING_NON_INVESTMENT_OUTCOME"
  | "INVESTMENT_LEARNING_SUBJECT_MISMATCH"
  | "INVESTMENT_LEARNING_ROUTE_MISMATCH"
  | "INVESTMENT_LEARNING_RUN_MISMATCH"
  | "INVESTMENT_LEARNING_DECISION_MISMATCH"
  | "INVESTMENT_LEARNING_RECOMMENDATION_MISMATCH"
  | "INVESTMENT_LEARNING_PLAN_MISMATCH"
  | "INVESTMENT_LEARNING_PRIOR_CONTEXT_MISMATCH"
  | "INVESTMENT_LEARNING_DUPLICATE_OUTCOME"
  | "INVESTMENT_LEARNING_ID_MISSING"
  | "INVESTMENT_LEARNING_DUPLICATE_ID"
  | "INVESTMENT_LEARNING_INVALID_CONTEXT"
  | "INVESTMENT_LEARNING_INVALID_SCOPE";

export class InvestmentLearningError extends PlatformError {
  public constructor(
    code: InvestmentLearningErrorCode,
    message: string,
  ) {
    super(code, message);
  }
}

/** Interprets immutable Investment Outcomes into durable Learning suggestions. */
export function deriveInvestmentLearning(
  command: DeriveInvestmentLearningCommand,
): InvestmentLearningResult {
  const lineage = validateSharedLineage(command);
  const rawCandidates =
    command.outcomes.flatMap((outcome) =>
      candidatesForOutcome(
        outcome,
        lineage.subjectId,
        lineage.recommendationId,
      ),
    );
  const candidates = applyScopes(
    mergeCandidates(rawCandidates),
    command,
    lineage.subjectId,
  );

  validateLearningContext(command, candidates);

  const learnings = candidates.map(
    (candidate) =>
      mapInvestmentLearningToPlatform(
        candidate,
        command.outcomes,
        command,
      ),
  );

  return {
    learningRunId:
      command.context.learningRunId,
    subjectId: lineage.subjectId,
    acquisitionType:
      lineage.acquisitionType,
    investmentRunId:
      lineage.investmentRunId,
    decisionId: lineage.decisionId,
    recommendationId:
      lineage.recommendationId,
    planId: lineage.planId,
    candidates,
    learnings,
  };
}

function validateSharedLineage(
  command: DeriveInvestmentLearningCommand,
) {
  if (command.outcomes.length === 0) {
    throw learningError(
      "INVESTMENT_LEARNING_OUTCOMES_EMPTY",
      "Investment Learning requires at least one Outcome.",
    );
  }
  const outcomeIds = command.outcomes.map(
    ({ id }) => id.value,
  );
  if (
    new Set(outcomeIds).size !==
    outcomeIds.length
  ) {
    throw learningError(
      "INVESTMENT_LEARNING_DUPLICATE_OUTCOME",
      "Investment Learning Outcomes must be unique.",
    );
  }

  const first = outcomeLineage(
    command.outcomes[0],
  );
  for (const outcome of command.outcomes) {
    const current = outcomeLineage(outcome);
    if (current.subjectId !== first.subjectId) {
      throw learningError(
        "INVESTMENT_LEARNING_SUBJECT_MISMATCH",
        "Investment Learning Outcomes must share one subject.",
      );
    }
    if (
      current.acquisitionType !==
      first.acquisitionType
    ) {
      throw learningError(
        "INVESTMENT_LEARNING_ROUTE_MISMATCH",
        "Investment Learning Outcomes must share one acquisition route.",
      );
    }
    if (
      current.investmentRunId !==
      first.investmentRunId
    ) {
      throw learningError(
        "INVESTMENT_LEARNING_RUN_MISMATCH",
        "Investment Learning Outcomes must share one analysis run.",
      );
    }
    if (current.decisionId !== first.decisionId) {
      throw learningError(
        "INVESTMENT_LEARNING_DECISION_MISMATCH",
        "Investment Learning Outcomes must share one Decision.",
      );
    }
    if (
      current.recommendationId !==
      first.recommendationId
    ) {
      throw learningError(
        "INVESTMENT_LEARNING_RECOMMENDATION_MISMATCH",
        "Investment Learning Outcomes must share one Recommendation.",
      );
    }
    if (current.planId !== first.planId) {
      throw learningError(
        "INVESTMENT_LEARNING_PLAN_MISMATCH",
        "Investment Learning Outcomes must share one execution plan.",
      );
    }
  }

  const {
    lifecycleResult,
    platformAnalysis,
    decision,
    planId,
  } = command.priorContext;
  if (
    lifecycleResult.analysis.property.id !==
      first.subjectId ||
    decision.context.subjectId !==
      first.subjectId
  ) {
    throw learningError(
      "INVESTMENT_LEARNING_PRIOR_CONTEXT_MISMATCH",
      "Investment Learning prior context does not match the Outcome subject.",
    );
  }
  if (
    lifecycleResult.acquisitionType !==
      first.acquisitionType ||
    platformAnalysis.acquisitionType !==
      first.acquisitionType ||
    decision.context.scope !==
      first.acquisitionType
  ) {
    throw learningError(
      "INVESTMENT_LEARNING_PRIOR_CONTEXT_MISMATCH",
      "Investment Learning prior context does not match the Outcome route.",
    );
  }
  if (
    platformAnalysis.lineage.runId !==
      first.investmentRunId ||
    decision.metadata.platformRunId !==
      first.investmentRunId
  ) {
    throw learningError(
      "INVESTMENT_LEARNING_PRIOR_CONTEXT_MISMATCH",
      "Investment Learning prior context does not match the Outcome run.",
    );
  }
  if (
    decision.id.value !== first.decisionId ||
    decision.recommendationIds.length !== 1 ||
    decision.recommendationIds[0].value !==
      first.recommendationId ||
    planId !== first.planId
  ) {
    throw learningError(
      "INVESTMENT_LEARNING_PRIOR_CONTEXT_MISMATCH",
      "Investment Learning Decision, Recommendation, or plan context is mismatched.",
    );
  }
  const recommendation =
    platformAnalysis.recommendations
      .toArray()
      .filter(
        ({ id }) =>
          id.value ===
          first.recommendationId,
      );
  if (
    recommendation.length !== 1 ||
    recommendation[0].metadata.propertyId !==
      first.subjectId ||
    recommendation[0].metadata.runId !==
      first.investmentRunId
  ) {
    throw learningError(
      "INVESTMENT_LEARNING_PRIOR_CONTEXT_MISMATCH",
      "Investment Learning Recommendation context is mismatched.",
    );
  }

  return first;
}

function outcomeLineage(outcome: Outcome) {
  if (
    outcome.type !==
      "investment-action-finding" ||
    outcome.metadata.capability !==
      "investment-intelligence"
  ) {
    throw learningError(
      "INVESTMENT_LEARNING_NON_INVESTMENT_OUTCOME",
      "Only canonical Investment Action Outcomes can produce Investment Learning.",
    );
  }

  const subjectId = metadataText(
    outcome,
    "propertyId",
    "INVESTMENT_LEARNING_SUBJECT_MISMATCH",
  );
  const acquisitionType = parseRoute(
    metadataText(
      outcome,
      "acquisitionType",
      "INVESTMENT_LEARNING_ROUTE_MISMATCH",
    ),
  );
  const investmentRunId = metadataText(
    outcome,
    "investmentRunId",
    "INVESTMENT_LEARNING_RUN_MISMATCH",
  );
  const decisionId = metadataText(
    outcome,
    "decisionId",
    "INVESTMENT_LEARNING_DECISION_MISMATCH",
  );
  const recommendationId = metadataText(
    outcome,
    "recommendationId",
    "INVESTMENT_LEARNING_RECOMMENDATION_MISMATCH",
  );
  const planId = metadataText(
    outcome,
    "executionPlanId",
    "INVESTMENT_LEARNING_PLAN_MISMATCH",
  );
  const intentKey = metadataText(
    outcome,
    "intentKey",
    "INVESTMENT_LEARNING_NON_INVESTMENT_OUTCOME",
  );
  const actorId = metadataText(
    outcome,
    "recordedByActorId",
    "INVESTMENT_LEARNING_NON_INVESTMENT_OUTCOME",
  );

  if (
    !outcome.lineage.decisionIds.some(
      ({ value }) => value === decisionId,
    ) ||
    !outcome.lineage.recommendationIds.some(
      ({ value }) =>
        value === recommendationId,
    ) ||
    outcome.lineage.actionIds.length === 0
  ) {
    throw learningError(
      "INVESTMENT_LEARNING_NON_INVESTMENT_OUTCOME",
      "Investment Outcome causal lineage is incomplete.",
    );
  }

  return {
    subjectId,
    acquisitionType,
    investmentRunId,
    decisionId,
    recommendationId,
    planId,
    intentKey,
    actorId,
  } as const;
}

function candidatesForOutcome(
  outcome: Outcome,
  subjectId: string,
  recommendationId: string,
): readonly InvestmentLearningCandidate[] {
  const lineage = outcomeLineage(outcome);
  const measurements = measuredValues(outcome);
  const assumptions = resultStrings(
    outcome,
    "assumptionReferences",
  );

  if (measurements.length > 0) {
    return measurements.map((measurement) => {
      const comparison = comparisonKind(
        measurement.key,
        measurement.actual,
        measurement.assumed,
      );
      const semantic =
        `assumption:${measurement.key}`;
      return candidate({
        key:
          `subject:${subjectId}:${semantic}:${comparison.kind}`,
        kind: comparison.kind,
        subjectId,
        title:
          `${comparison.kindLabel}: ${measurement.key}`,
        summary:
          measurement.assumed === undefined
            ? `Measured ${measurement.key} at ${measurement.actual}; the prior model did not contain a directly comparable assumed value.`
            : `Measured ${measurement.key} at ${measurement.actual} versus an assumed ${measurement.assumed}, a variance of ${measurement.actual - measurement.assumed}.`,
        outcome,
        assumptionReferences:
          assumptions.length > 0
            ? assumptions
            : [measurement.key],
        recommendationId,
        confidenceImpact:
          confidenceImpact(
            comparison.kind,
            comparison.ratio,
            semantic,
          ),
        policyImpact: policyImpact(
          comparison.kind,
          policyTarget(
            measurement.key,
            lineage.intentKey,
          ),
        ),
      });
    });
  }

  const disposition = metadataText(
    outcome,
    "disposition",
    "INVESTMENT_LEARNING_NON_INVESTMENT_OUTCOME",
  );
  const kind = qualitativeKind(disposition);
  const semantic = semanticFindingKey(
    lineage.intentKey,
  );
  return [candidate({
    key:
      `subject:${subjectId}:${semantic}:${kind}`,
    kind,
    subjectId,
    title: `${kindLabel(kind)}: ${semantic.replaceAll("-", " ")}`,
    summary: outcome.summary,
    outcome,
    assumptionReferences: assumptions,
    recommendationId,
    confidenceImpact:
      confidenceImpact(
        kind,
        undefined,
        semantic,
      ),
    policyImpact: policyImpact(
      kind,
      policyTarget(
        semantic,
        lineage.intentKey,
      ),
    ),
  })];
}

function candidate(input: {
  key: string;
  kind: InvestmentLearningKind;
  subjectId: string;
  title: string;
  summary: string;
  outcome: Outcome;
  assumptionReferences: readonly string[];
  recommendationId: string;
  confidenceImpact: InvestmentConfidenceImpact;
  policyImpact: InvestmentPolicyImpact;
}): InvestmentLearningCandidate {
  return {
    key: input.key,
    kind: input.kind,
    scope: {
      kind: "subject",
      subjectId: input.subjectId,
    },
    title: input.title,
    summary: input.summary,
    outcomeIds: [input.outcome.id.value],
    actionIds:
      input.outcome.lineage.actionIds.map(
        ({ value }) => value,
      ),
    assumptionReferences:
      unique(input.assumptionReferences),
    recommendationReferences: [
      input.recommendationId,
    ],
    sourceActorIds: [
      metadataText(
        input.outcome,
        "recordedByActorId",
        "INVESTMENT_LEARNING_NON_INVESTMENT_OUTCOME",
      ),
    ],
    confidenceImpact:
      input.confidenceImpact,
    policyImpact: input.policyImpact,
  };
}

function mergeCandidates(
  values: readonly InvestmentLearningCandidate[],
): readonly InvestmentLearningCandidate[] {
  const merged = new Map<
    string,
    InvestmentLearningCandidate
  >();
  for (const value of values) {
    const existing = merged.get(value.key);
    if (!existing) {
      merged.set(value.key, value);
      continue;
    }
    merged.set(value.key, {
      ...existing,
      outcomeIds: unique([
        ...existing.outcomeIds,
        ...value.outcomeIds,
      ]),
      actionIds: unique([
        ...existing.actionIds,
        ...value.actionIds,
      ]),
      assumptionReferences: unique([
        ...existing.assumptionReferences,
        ...value.assumptionReferences,
      ]),
      recommendationReferences: unique([
        ...existing.recommendationReferences,
        ...value.recommendationReferences,
      ]),
      sourceActorIds: unique([
        ...existing.sourceActorIds,
        ...value.sourceActorIds,
      ]),
    });
  }
  return [...merged.values()];
}

function applyScopes(
  candidates:
    readonly InvestmentLearningCandidate[],
  command: DeriveInvestmentLearningCommand,
  subjectId: string,
): readonly InvestmentLearningCandidate[] {
  return candidates.map((value) => {
    const override =
      command.context.scopeOverrides?.[
        value.key
      ];
    if (!override) return value;
    if (!override.justification.trim()) {
      throw learningError(
        "INVESTMENT_LEARNING_INVALID_SCOPE",
        "Broader Investment Learning scope requires explicit justification.",
      );
    }
    if (
      (override.kind === "market" &&
        !override.marketId.trim()) ||
      (override.kind ===
        "assumption-policy" &&
        !override.assumptionKey.trim()) ||
      (override.kind === "strategy" &&
        override.acquisitionType !==
          command.priorContext
            .lifecycleResult.acquisitionType)
    ) {
      throw learningError(
        "INVESTMENT_LEARNING_INVALID_SCOPE",
        "Broader Investment Learning scope must match its explicit target.",
      );
    }
    return {
      ...value,
      scope: override,
      summary:
        `${value.summary} Scope justification: ${override.justification.trim()}`,
    };
  }).map((value) => ({
    ...value,
    scope:
      value.scope.kind === "subject"
        ? { kind: "subject", subjectId }
        : value.scope,
  }));
}

function validateLearningContext(
  command: DeriveInvestmentLearningCommand,
  candidates:
    readonly InvestmentLearningCandidate[],
): void {
  if (
    !command.context.learningRunId.trim() ||
    !command.actor.id.trim() ||
    !(command.context.derivedAt instanceof Date) ||
    Number.isNaN(
      command.context.derivedAt.getTime(),
    )
  ) {
    throw learningError(
      "INVESTMENT_LEARNING_INVALID_CONTEXT",
      "Investment Learning requires stable run, actor, and timestamp values.",
    );
  }
  const ids = candidates.map(({ key }) => {
    const id =
      command.context.learningIds[key]?.trim();
    if (!id) {
      throw learningError(
        "INVESTMENT_LEARNING_ID_MISSING",
        `No Learning ID was supplied for candidate ${key}.`,
      );
    }
    return id;
  });
  if (new Set(ids).size !== ids.length) {
    throw learningError(
      "INVESTMENT_LEARNING_DUPLICATE_ID",
      "Investment Learning artifact IDs must be unique.",
    );
  }
}

function measuredValues(outcome: Outcome) {
  return Object.entries(outcome.metrics)
    .filter(
      ([key]) =>
        !key.endsWith(".assumed") &&
        !key.endsWith(".variance") &&
        key !== "durationMs",
    )
    .map(([key, actual]) => ({
      key,
      actual,
      assumed:
        outcome.metrics[`${key}.assumed`],
    }));
}

function comparisonKind(
  key: string,
  actual: number,
  assumed: number | undefined,
) {
  if (assumed === undefined) {
    return {
      kind: "refined" as const,
      kindLabel: "Refined assumption",
      ratio: undefined,
    };
  }
  const ratio =
    Math.abs(actual - assumed) /
    Math.max(Math.abs(assumed), 1);
  const confirmedTolerance =
    /rent|adr|occupancy/.test(key)
      ? 0.03
      : CONFIRMED_VARIANCE_RATIO;
  const refinedTolerance =
    /rent|adr|occupancy/.test(key)
      ? 0.1
      : REFINED_VARIANCE_RATIO;
  if (ratio <= confirmedTolerance) {
    return {
      kind: "confirmed" as const,
      kindLabel: "Confirmed assumption",
      ratio,
    };
  }
  if (ratio <= refinedTolerance) {
    return {
      kind: "refined" as const,
      kindLabel: "Refined assumption",
      ratio,
    };
  }
  return {
    kind: "contradicted" as const,
    kindLabel: "Contradicted assumption",
    ratio,
  };
}

function qualitativeKind(
  disposition: string,
): InvestmentLearningKind {
  switch (disposition) {
    case "favorable":
      return "confirmed";
    case "unfavorable":
      return "contradicted";
    case "neutral":
      return "refined";
    case "inconclusive":
      return "unresolved";
    default:
      throw learningError(
        "INVESTMENT_LEARNING_NON_INVESTMENT_OUTCOME",
        "Investment Outcome disposition is invalid.",
      );
  }
}

function confidenceImpact(
  kind: InvestmentLearningKind,
  ratio: number | undefined,
  semantic: string,
): InvestmentConfidenceImpact {
  if (kind === "confirmed") {
    return {
      direction: "increase",
      magnitude:
        semantic.includes("permission")
          ? "moderate"
          : "minor",
      rationale:
        "Measured reality supports the prior Investment assumption or judgment; future confidence may increase after governance review.",
    };
  }
  if (kind === "contradicted") {
    return {
      direction: "decrease",
      magnitude:
        semantic.includes("regulatory") ||
        semantic.includes("permission") ||
        (ratio !== undefined &&
          ratio > MAJOR_VARIANCE_RATIO)
          ? "major"
          : "moderate",
      rationale:
        "Measured reality conflicts with the prior Investment assumption or judgment; future confidence should be reviewed.",
    };
  }
  if (kind === "refined") {
    return {
      direction: "increase",
      magnitude: "minor",
      rationale:
        "Measured reality adds precision without fully confirming or contradicting the prior judgment.",
    };
  }
  return {
    direction: "none",
    rationale:
      "The Outcome leaves material uncertainty unresolved and does not justify a confidence increase.",
  };
}

function policyImpact(
  kind: InvestmentLearningKind,
  target: InvestmentPolicyImpactTarget,
): InvestmentPolicyImpact {
  return {
    target,
    disposition:
      kind === "confirmed"
        ? "no-change"
        : "review",
    rationale:
      kind === "confirmed"
        ? `The ${target} remains supported by this Outcome.`
        : `The ${target} should be reviewed; this Learning does not apply a policy change.`,
  };
}

function policyTarget(
  semantic: string,
  intentKey: string,
): InvestmentPolicyImpactTarget {
  const value =
    `${semantic}:${intentKey}`;
  if (
    /insurance|premium|tax|repair|setup|rent|utilit/.test(
      value,
    )
  ) {
    return "expense-assumption";
  }
  if (
    /financ|interest|loan|down-payment/.test(
      value,
    )
  ) {
    return "financing-assumption";
  }
  if (/regulation/.test(value)) {
    return "regulatory-assumption";
  }
  if (/landlord-permission/.test(value)) {
    return "execution-policy";
  }
  if (/market|adr|occupancy/.test(value)) {
    return "revenue-assumption";
  }
  return "risk-policy";
}

function semanticFindingKey(
  intentKey: string,
): string {
  switch (intentKey) {
    case "verify-str-regulations":
      return "regulatory-permission";
    case "verify-landlord-permission":
      return "landlord-permission";
    case "complete-property-inspection":
      return "property-condition";
    default:
      return `intent:${intentKey}`;
  }
}

function resultStrings(
  outcome: Outcome,
  key: string,
): readonly string[] {
  const value = outcome.result[key];
  return Array.isArray(value)
    ? unique(
        value.filter(
          (entry): entry is string =>
            typeof entry === "string",
        ),
      )
    : [];
}

function metadataText(
  outcome: Outcome,
  key: string,
  code: InvestmentLearningErrorCode,
): string {
  const value = outcome.metadata[key];
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw learningError(
      code,
      `Investment Outcome metadata is missing ${key}.`,
    );
  }
  return value.trim();
}

function parseRoute(value: string): AcquisitionType {
  if (value === AcquisitionType.Purchase) {
    return AcquisitionType.Purchase;
  }
  if (
    value ===
    AcquisitionType.RentalArbitrage
  ) {
    return AcquisitionType.RentalArbitrage;
  }
  throw learningError(
    "INVESTMENT_LEARNING_ROUTE_MISMATCH",
    "Investment Outcome acquisition route is unsupported.",
  );
}

function kindLabel(
  kind: InvestmentLearningKind,
): string {
  return `${kind[0].toUpperCase()}${kind.slice(1)} learning`;
}

function unique(
  values: readonly string[],
): readonly string[] {
  return [...new Set(values)];
}

function learningError(
  code: InvestmentLearningErrorCode,
  message: string,
): InvestmentLearningError {
  return new InvestmentLearningError(
    code,
    message,
  );
}
