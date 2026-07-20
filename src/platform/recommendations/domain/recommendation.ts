import {
  EntityWithProps,
  Identifier,
} from "../../kernel";
import type { EvaluationId } from "../../evaluations";
import type { EvidenceId } from "../../evidence";
import type { ClaimId } from "../../claims";
import type { ObservationId, ObservationValue } from "../../observations";
import {
  ConfidenceAssessment,
  ConfidenceLevel,
  ConfidenceScore,
} from "../../scoring";
import {
  createRecommendationId,
  type RecommendationId,
} from "./recommendation-id";
import { RecommendationPriority } from "./recommendation-priority";

type RecommendationProps = Readonly<{
  summary: string;
  rationale: readonly string[];
  priority: RecommendationPriority;
  category: string;
  confidence: Readonly<{
    score: number;
    level: ConfidenceLevel;
    rationale: readonly string[];
  }>;
  evaluationIdValues: readonly string[];
  evidenceIdValues: readonly string[];
  claimIdValues: readonly string[];
  observationIdValues: readonly string[];
  metadata: Readonly<Record<string, ObservationValue>>;
}>;

export type RecommendationInput = Readonly<{
  id?: RecommendationId;
  summary: string;
  rationale: readonly string[];
  priority: RecommendationPriority;
  category: string;
  confidence: ConfidenceAssessment;
  evaluationIds: readonly EvaluationId[];
  evidenceIds?: readonly EvidenceId[];
  claimIds?: readonly ClaimId[];
  observationIds?: readonly ObservationId[];
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

/** Immutable proposed action produced from completed Evaluations. */
export class Recommendation extends EntityWithProps<
  RecommendationProps,
  RecommendationId
> {
  private constructor(id: RecommendationId, props: RecommendationProps) {
    super(id, props);
  }

  public static create(input: RecommendationInput): Recommendation {
    const evaluationIdValues = uniqueIds(
      input.evaluationIds.map((id) => id.value),
      "Recommendation supporting Evaluations",
      true,
    );
    const evidenceIdValues = uniqueIds(
      (input.evidenceIds ?? []).map((id) => id.value),
      "Recommendation supporting Evidence",
      false,
    );

    return new Recommendation(input.id ?? createRecommendationId(), {
      summary: requireText(input.summary, "Recommendation summary"),
      rationale: requireTextList(input.rationale, "Recommendation rationale"),
      priority: requirePriority(input.priority),
      category: requireText(input.category, "Recommendation category"),
      confidence: {
        score: input.confidence.score.value,
        level: input.confidence.level,
        rationale: [...input.confidence.rationale],
      },
      evaluationIdValues,
      evidenceIdValues,
      claimIdValues: uniqueIds(
        (input.claimIds ?? []).map((id) => id.value),
        "Recommendation supporting Claims",
        false,
      ),
      observationIdValues: uniqueIds(
        (input.observationIds ?? []).map((id) => id.value),
        "Recommendation supporting Observations",
        false,
      ),
      metadata: Object.freeze({ ...input.metadata }),
    });
  }

  public get summary(): string {
    return this.props.summary;
  }

  public get rationale(): readonly string[] {
    return [...this.props.rationale];
  }

  public get priority(): RecommendationPriority {
    return this.props.priority;
  }

  public get category(): string {
    return this.props.category;
  }

  public get confidence(): ConfidenceAssessment {
    return ConfidenceAssessment.create({
      score: ConfidenceScore.create(this.props.confidence.score),
      level: this.props.confidence.level,
      rationale: this.props.confidence.rationale,
    });
  }

  public get evaluationIds(): readonly EvaluationId[] {
    return this.props.evaluationIdValues.map((value) => Identifier.create(value));
  }

  public get evidenceIds(): readonly EvidenceId[] {
    return this.props.evidenceIdValues.map((value) => Identifier.create(value));
  }

  public get claimIds(): readonly ClaimId[] {
    return this.props.claimIdValues.map((value) => Identifier.create(value));
  }

  public get observationIds(): readonly ObservationId[] {
    return this.props.observationIdValues.map((value) => Identifier.create(value));
  }

  public get metadata(): Readonly<Record<string, ObservationValue>> {
    return this.props.metadata;
  }

  public supportedByEvaluation(id: EvaluationId): boolean {
    return this.props.evaluationIdValues.includes(id.value);
  }

  public supportedByEvidence(id: EvidenceId): boolean {
    return this.props.evidenceIdValues.includes(id.value);
  }
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} cannot be empty.`);
  return normalized;
}

function requireTextList(values: readonly string[], field: string): readonly string[] {
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (normalized.length === 0) throw new TypeError(`${field} cannot be empty.`);
  return Object.freeze(normalized);
}

function uniqueIds(
  values: readonly string[],
  field: string,
  required: boolean,
): readonly string[] {
  const normalized = [...new Set(values)];
  if (required && normalized.length === 0) {
    throw new TypeError(`${field} cannot be empty.`);
  }
  return Object.freeze(normalized);
}

function requirePriority(value: RecommendationPriority): RecommendationPriority {
  if (!Object.values(RecommendationPriority).includes(value)) {
    throw new TypeError("Recommendation priority is invalid.");
  }
  return value;
}
