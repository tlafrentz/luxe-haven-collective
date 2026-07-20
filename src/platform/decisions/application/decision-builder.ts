import { Identifier } from "../../kernel";
import type { ObservationValue } from "../../observations";
import {
  RECOMMENDATION_PRIORITY_RANK,
  type Recommendation,
  type RecommendationPriority,
} from "../../recommendations";

import {
  Decision,
} from "../domain/decision";
import {
  DecisionContext,
  type DecisionContextInput,
} from "../domain/decision-context";
import type {
  DecisionOption,
} from "../domain/decision-option";
import {
  DecisionOptions,
} from "../domain/decision-options";
import type {
  DecisionOutcome,
} from "../domain/decision-outcome";
import {
  DecisionRationale,
  type DecisionRationaleInput,
} from "../domain/decision-rationale";
import type { DecisionPolicyResult } from "./decision-policy";

export type PolicyDecisionBuilderInput = Readonly<{
  result: DecisionPolicyResult;
  decidedAt: Date;
  id?: Identifier;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

type DecisionBuilderState<
  TOutcome extends DecisionOutcome,
> = {
  id?: Identifier;
  type?: string;
  outcome?: TOutcome;
  context?: DecisionContext;
  rationale?: DecisionRationale;
  options?: DecisionOptions<TOutcome>;
  decidedAt?: Date;
};

/**
 * Fluent orchestration boundary for constructing a valid Decision.
 */
export class DecisionBuilder<
  TOutcome extends DecisionOutcome,
> {
  private readonly state: DecisionBuilderState<TOutcome> = {};

  public static create<
    TOutcome extends DecisionOutcome,
  >(): DecisionBuilder<TOutcome> {
    return new DecisionBuilder<TOutcome>();
  }

  public withId(id: Identifier): this {
    this.state.id = id;
    return this;
  }

  public forType(type: string): this {
    this.state.type = type;
    return this;
  }

  public withOutcome(outcome: TOutcome): this {
    this.state.outcome = outcome;
    return this;
  }

  public inContext(
    context: DecisionContext | DecisionContextInput,
  ): this {
    this.state.context =
      context instanceof DecisionContext
        ? context
        : DecisionContext.create(context);

    return this;
  }

  public because(
    rationale:
      | DecisionRationale
      | DecisionRationaleInput,
  ): this {
    this.state.rationale =
      rationale instanceof DecisionRationale
        ? rationale
        : DecisionRationale.create(rationale);

    return this;
  }

  public considering(
    options:
      | DecisionOptions<TOutcome>
      | readonly DecisionOption<TOutcome>[],
  ): this {
    this.state.options =
      options instanceof DecisionOptions
        ? options
        : new DecisionOptions(options);

    return this;
  }

  public at(decidedAt: Date): this {
    this.state.decidedAt = new Date(decidedAt);
    return this;
  }

  public build(): Decision<TOutcome> {
    const missing = this.missingFields();

    if (missing.length > 0) {
      throw new DecisionBuildError(missing);
    }

    return Decision.create({
      ...(this.state.id
        ? { id: this.state.id }
        : {}),
      type: this.state.type!,
      outcome: this.state.outcome!,
      context: this.state.context!,
      rationale: this.state.rationale!,
      decidedAt: this.state.decidedAt!,
      ...(this.state.options
        ? { options: this.state.options }
        : {}),
    });
  }

  public buildFromPolicy(
    input: PolicyDecisionBuilderInput,
  ): Decision<DecisionOutcome> {
    const selected = uniqueRecommendations(input.result.selectedRecommendations);
    const confidence = input.result.confidence ?? inheritedConfidence(selected);
    const priority = input.result.priority ?? highestPriority(selected);

    return Decision.create({
      ...(input.id ? { id: input.id } : {}),
      type: input.result.category,
      outcome: input.result.mode,
      title: input.result.title,
      summary: input.result.summary,
      mode: input.result.mode,
      priority,
      confidence,
      context: {
        subjectType: "recommendation",
        subjectId: selected[0].id.value,
        effectiveAt: input.decidedAt,
        scope: input.result.category,
      },
      rationale: {
        summary: input.result.summary,
        supportingReasons: input.result.rationale,
        confidence,
      },
      recommendationIds: selected.map((value) => value.id),
      evaluationIds: uniqueIdentifiers(selected.flatMap((value) => value.evaluationIds)),
      claimIds: uniqueIdentifiers(selected.flatMap((value) => value.claimIds)),
      evidenceIds: uniqueIdentifiers(selected.flatMap((value) => value.evidenceIds)),
      observationIds: uniqueIdentifiers(selected.flatMap((value) => value.observationIds)),
      metadata: { ...input.result.metadata, ...input.metadata },
      decidedAt: input.decidedAt,
    });
  }

  private missingFields(): readonly string[] {
    const missing: string[] = [];

    if (!this.state.type) {
      missing.push("type");
    }
    if (!this.state.outcome) {
      missing.push("outcome");
    }
    if (!this.state.context) {
      missing.push("context");
    }
    if (!this.state.rationale) {
      missing.push("rationale");
    }
    if (!this.state.decidedAt) {
      missing.push("decidedAt");
    }

    return missing;
  }
}

function uniqueRecommendations(values: readonly Recommendation[]): readonly Recommendation[] {
  const unique = [...new Map(values.map((value) => [value.id.value, value])).values()];
  if (unique.length === 0) {
    throw new TypeError("Decision selected Recommendations cannot be empty.");
  }
  return unique;
}

function uniqueIdentifiers<TIdentifier extends Identifier>(
  values: readonly TIdentifier[],
): readonly TIdentifier[] {
  return [...new Map(values.map((value) => [value.value, value])).values()];
}

function inheritedConfidence(values: readonly Recommendation[]) {
  if (values.length !== 1) {
    throw new TypeError(
      "Decision confidence is required when multiple Recommendations are selected.",
    );
  }
  return values[0].confidence;
}

function highestPriority(values: readonly Recommendation[]): RecommendationPriority {
  return [...values]
    .sort((first, second) =>
      RECOMMENDATION_PRIORITY_RANK[second.priority] -
      RECOMMENDATION_PRIORITY_RANK[first.priority],
    )[0].priority;
}

export class DecisionBuildError extends Error {
  public readonly missingFields: readonly string[];

  public constructor(
    missingFields: readonly string[],
  ) {
    super(
      `Cannot build decision. Missing required fields: ${missingFields.join(", ")}.`,
    );
    this.name = "DecisionBuildError";
    this.missingFields = Object.freeze([
      ...missingFields,
    ]);
  }
}
