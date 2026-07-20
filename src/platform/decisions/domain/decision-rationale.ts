import { ValueObject } from "../../kernel";
import {
  ConfidenceAssessment,
} from "../../scoring";

type DecisionRationaleProps = {
  readonly summary: string;
  readonly supportingReasons: readonly string[];
  readonly assumptions: readonly string[];
  readonly risks: readonly string[];
  readonly confidence?: ConfidenceSnapshot;
};

type ConfidenceSnapshot = {
  readonly score: number;
  readonly level: string;
  readonly rationale: readonly string[];
};

export type DecisionRationaleInput = Readonly<{
  summary: string;
  supportingReasons?: readonly string[];
  assumptions?: readonly string[];
  risks?: readonly string[];
  confidence?: ConfidenceAssessment;
}>;

/**
 * Structured explanation for why a decision was reached.
 */
export class DecisionRationale extends ValueObject<DecisionRationaleProps> {
  private constructor(props: DecisionRationaleProps) {
    super(props);
  }

  public static create(
    input: DecisionRationaleInput,
  ): DecisionRationale {
    const summary = input.summary.trim();

    if (summary.length === 0) {
      throw new TypeError(
        "Decision rationale summary cannot be empty.",
      );
    }

    return new DecisionRationale({
      summary,
      supportingReasons: normalizeEntries(
        input.supportingReasons ?? [],
      ),
      assumptions: normalizeEntries(input.assumptions ?? []),
      risks: normalizeEntries(input.risks ?? []),
      ...(input.confidence
        ? { confidence: toConfidenceSnapshot(input.confidence) }
        : {}),
    });
  }

  public get summary(): string {
    return this.props.summary;
  }

  public get supportingReasons(): readonly string[] {
    return this.props.supportingReasons;
  }

  public get assumptions(): readonly string[] {
    return this.props.assumptions;
  }

  public get risks(): readonly string[] {
    return this.props.risks;
  }

  public get confidence(): ConfidenceAssessment | undefined {
    if (!this.props.confidence) {
      return undefined;
    }

    return ConfidenceAssessment.create({
      score: ConfidenceScore.create(
        this.props.confidence.score,
      ),
      level: this.props.confidence.level as ConfidenceLevel,
      rationale: this.props.confidence.rationale,
    });
  }

  public hasRisks(): boolean {
    return this.risks.length > 0;
  }

  public hasAssumptions(): boolean {
    return this.assumptions.length > 0;
  }
}

import {
  ConfidenceLevel,
  ConfidenceScore,
} from "../../scoring";

function normalizeEntries(
  entries: readonly string[],
): readonly string[] {
  const normalized = entries
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return [...new Set(normalized)];
}

function toConfidenceSnapshot(
  confidence: ConfidenceAssessment,
): ConfidenceSnapshot {
  return {
    score: confidence.score.value,
    level: confidence.level,
    rationale: [...confidence.rationale],
  };
}
