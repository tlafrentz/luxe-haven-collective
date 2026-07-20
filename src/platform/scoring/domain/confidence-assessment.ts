import { ValueObject } from "../../kernel";

import { mapConfidenceLevel } from "../application/map-confidence-level";
import { ConfidenceLevel } from "./confidence-level";
import { ConfidenceScore } from "./confidence-score";

type ConfidenceAssessmentProps = {
  readonly scoreValue: number;
  readonly level: ConfidenceLevel;
  readonly rationale: readonly string[];
};

/**
 * Complete confidence interpretation containing a score, mapped level, and
 * evidence-based rationale.
 */
export class ConfidenceAssessment extends ValueObject<ConfidenceAssessmentProps> {
  private constructor(props: ConfidenceAssessmentProps) {
    super(props);
  }

  public static create(input: Readonly<{
    score: ConfidenceScore;
    rationale: readonly string[];
    level?: ConfidenceLevel;
  }>): ConfidenceAssessment {
    const rationale = normalizeRationale(input.rationale);

    return new ConfidenceAssessment({
      scoreValue: input.score.value,
      level: input.level ?? mapConfidenceLevel(input.score),
      rationale,
    });
  }

  public get score(): ConfidenceScore {
    return ConfidenceScore.create(this.props.scoreValue);
  }

  public get level(): ConfidenceLevel {
    return this.props.level;
  }

  public get rationale(): readonly string[] {
    return this.props.rationale;
  }

  public hasRationale(): boolean {
    return this.rationale.length > 0;
  }
}

function normalizeRationale(
  rationale: readonly string[],
): readonly string[] {
  const normalized = rationale
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return [...new Set(normalized)];
}
