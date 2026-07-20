import {
  EntityWithProps,
  Identifier,
} from "../../kernel";
import type { ClaimId } from "../../claims";
import type { EvaluationId } from "../../evaluations";
import type { EvidenceId } from "../../evidence";
import type { ObservationId, ObservationValue } from "../../observations";
import type { RecommendationId } from "../../recommendations";
import { RecommendationPriority } from "../../recommendations";
import {
  ConfidenceAssessment,
  ConfidenceLevel,
  ConfidenceScore,
} from "../../scoring";

import {
  DecisionContext,
  type DecisionContextInput,
} from "./decision-context";
import type { DecisionOption } from "./decision-option";
import {
  DecisionOptions,
} from "./decision-options";
import type { DecisionOutcome } from "./decision-outcome";
import {
  DecisionRationale,
  type DecisionRationaleInput,
} from "./decision-rationale";
import { DecisionMode } from "./decision-mode";

type ConfidenceSnapshot = Readonly<{
  score: number;
  level: ConfidenceLevel;
  rationale: readonly string[];
}>;

type DecisionProps<
  TOutcome extends DecisionOutcome,
> = Readonly<{
  type: string;
  outcome: TOutcome;
  context: DecisionContext;
  rationale: DecisionRationale;
  decidedAt: Date;
  options?: readonly DecisionOption<TOutcome>[];
  title: string;
  summary: string;
  mode: DecisionMode;
  priority: RecommendationPriority;
  confidence: ConfidenceSnapshot;
  recommendationIdValues: readonly string[];
  evaluationIdValues: readonly string[];
  claimIdValues: readonly string[];
  evidenceIdValues: readonly string[];
  observationIdValues: readonly string[];
  metadata: Readonly<Record<string, ObservationValue>>;
}>;

export type DecisionInput<
  TOutcome extends DecisionOutcome,
> = Readonly<{
  id?: Identifier;
  type: string;
  outcome: TOutcome;
  context: DecisionContext | DecisionContextInput;
  rationale:
    | DecisionRationale
    | DecisionRationaleInput;
  decidedAt: Date;
  options?:
    | DecisionOptions<TOutcome>
    | readonly DecisionOption<TOutcome>[];
  title?: string;
  summary?: string;
  mode?: DecisionMode;
  priority?: RecommendationPriority;
  confidence?: ConfidenceAssessment;
  recommendationIds?: readonly RecommendationId[];
  evaluationIds?: readonly EvaluationId[];
  claimIds?: readonly ClaimId[];
  evidenceIds?: readonly EvidenceId[];
  observationIds?: readonly ObservationId[];
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

/**
 * Canonical platform conclusion produced by an intelligence capability.
 */
export class Decision<
  TOutcome extends DecisionOutcome,
> extends EntityWithProps<DecisionProps<TOutcome>> {
  private constructor(
    id: Identifier,
    props: DecisionProps<TOutcome>,
  ) {
    super(id, props);
  }

  public static create<
    TOutcome extends DecisionOutcome,
  >(
    input: DecisionInput<TOutcome>,
  ): Decision<TOutcome> {
    const type = requireText(
      input.type,
      "Decision type",
    );
    const outcome = requireText(
      input.outcome,
      "Decision outcome",
    ) as TOutcome;

    assertValidDate(input.decidedAt);

    const options = normalizeOptions(input.options);

    if (options && !options.has(outcome)) {
      throw new RangeError(
        "Decision outcome must exist in the evaluated options.",
      );
    }

    const rationale =
      input.rationale instanceof DecisionRationale
        ? input.rationale
        : DecisionRationale.create(input.rationale);
    const confidence = input.confidence ?? rationale.confidence ?? ConfidenceAssessment.create({
      score: ConfidenceScore.create(0),
      level: ConfidenceLevel.VERY_LOW,
      rationale: ["Legacy Decision did not capture confidence."],
    });

    return new Decision(
      input.id ?? createDecisionIdentifier(),
      {
        type,
        outcome,
        context:
          input.context instanceof DecisionContext
            ? input.context
            : DecisionContext.create(input.context),
        rationale,
        decidedAt: new Date(input.decidedAt),
        ...(options
          ? { options: options.all() }
          : {}),
        title: requireText(input.title ?? type, "Decision title"),
        summary: requireText(input.summary ?? rationale.summary, "Decision summary"),
        mode: input.mode ?? DecisionMode.AUTOMATIC,
        priority: input.priority ?? RecommendationPriority.MEDIUM,
        confidence: {
          score: confidence.score.value,
          level: confidence.level,
          rationale: [...confidence.rationale],
        },
        recommendationIdValues: uniqueValues(input.recommendationIds),
        evaluationIdValues: uniqueValues(input.evaluationIds),
        claimIdValues: uniqueValues(input.claimIds),
        evidenceIdValues: uniqueValues(input.evidenceIds),
        observationIdValues: uniqueValues(input.observationIds),
        metadata: Object.freeze({ ...input.metadata }),
      },
    );
  }

  public get type(): string {
    return this.props.type;
  }

  public get outcome(): TOutcome {
    return this.props.outcome;
  }

  public get context(): DecisionContext {
    return this.props.context;
  }

  public get rationale(): DecisionRationale {
    return this.props.rationale;
  }

  public get decidedAt(): Date {
    return new Date(this.props.decidedAt);
  }

  public get options():
    | DecisionOptions<TOutcome>
    | undefined {
    return this.props.options
      ? new DecisionOptions(this.props.options)
      : undefined;
  }

  public get selectedOption():
    | DecisionOption<TOutcome>
    | undefined {
    return this.options?.find(this.outcome);
  }

  public get title(): string { return this.props.title; }
  public get summary(): string { return this.props.summary; }
  public get mode(): DecisionMode { return this.props.mode; }
  public get priority(): RecommendationPriority { return this.props.priority; }
  public get confidence(): ConfidenceAssessment {
    return ConfidenceAssessment.create({
      score: ConfidenceScore.create(this.props.confidence.score),
      level: this.props.confidence.level,
      rationale: this.props.confidence.rationale,
    });
  }
  public get recommendationIds(): readonly RecommendationId[] {
    return identifiers(this.props.recommendationIdValues);
  }
  public get evaluationIds(): readonly EvaluationId[] {
    return identifiers(this.props.evaluationIdValues);
  }
  public get claimIds(): readonly ClaimId[] { return identifiers(this.props.claimIdValues); }
  public get evidenceIds(): readonly EvidenceId[] { return identifiers(this.props.evidenceIdValues); }
  public get observationIds(): readonly ObservationId[] {
    return identifiers(this.props.observationIdValues);
  }
  public get metadata(): Readonly<Record<string, ObservationValue>> { return this.props.metadata; }

  public isOutcome(
    outcome: DecisionOutcome,
  ): outcome is TOutcome {
    return this.outcome === outcome;
  }
}

function uniqueValues(values: readonly Identifier[] | undefined): readonly string[] {
  return Object.freeze([...new Set((values ?? []).map((value) => value.value))]);
}

function identifiers<TIdentifier extends Identifier>(values: readonly string[]): readonly TIdentifier[] {
  return values.map((value) => Identifier.create(value) as TIdentifier);
}

function normalizeOptions<
  TOutcome extends DecisionOutcome,
>(
  options:
    | DecisionOptions<TOutcome>
    | readonly DecisionOption<TOutcome>[]
    | undefined,
): DecisionOptions<TOutcome> | undefined {
  if (!options) {
    return undefined;
  }

  return options instanceof DecisionOptions
    ? options
    : new DecisionOptions(options);
}

function createDecisionIdentifier(): Identifier {
  return Identifier.create(
    `decision-${crypto.randomUUID()}`,
  );
}

function assertValidDate(value: Date): void {
  if (
    !(value instanceof Date) ||
    Number.isNaN(value.getTime())
  ) {
    throw new TypeError(
      "Decision date must be valid.",
    );
  }
}

function requireText(
  value: string,
  field: string,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new TypeError(
      `${field} cannot be empty.`,
    );
  }

  return normalized;
}
