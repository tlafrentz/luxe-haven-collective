import type { DecisionOption } from "./decision-option";
import type { DecisionOutcome } from "./decision-outcome";

const MINIMUM_SCORE = 0;
const MAXIMUM_SCORE = 100;

/**
 * Immutable ranked alternatives considered by a decision.
 *
 * The feature owns how options are evaluated. The platform owns structural
 * integrity: identity, ranking, score bounds, and deterministic ordering.
 */
export class DecisionOptions<
  TOutcome extends DecisionOutcome,
> {
  private readonly values: readonly DecisionOption<TOutcome>[];

  public constructor(
    options: readonly DecisionOption<TOutcome>[],
  ) {
    if (options.length === 0) {
      throw new RangeError(
        "Decision options cannot be empty.",
      );
    }

    const normalized = options.map(normalizeOption);

    assertUnique(
      normalized.map((option) => option.key),
      "Decision option keys must be unique.",
    );
    assertUnique(
      normalized.map((option) => option.outcome),
      "Decision option outcomes must be unique.",
    );
    assertUnique(
      normalized.map((option) => option.rank),
      "Decision option ranks must be unique.",
    );
    assertContiguousRanks(normalized);

    this.values = Object.freeze(
      [...normalized].sort(
        (first, second) => first.rank - second.rank,
      ),
    );
  }

  public all(): readonly DecisionOption<TOutcome>[] {
    return this.values;
  }

  public best(): DecisionOption<TOutcome> {
    return this.values[0];
  }

  public find(
    outcome: TOutcome,
  ): DecisionOption<TOutcome> | undefined {
    return this.values.find(
      (option) => option.outcome === outcome,
    );
  }

  public has(outcome: TOutcome): boolean {
    return this.find(outcome) !== undefined;
  }

  public atRank(
    rank: number,
  ): DecisionOption<TOutcome> | undefined {
    return this.values.find(
      (option) => option.rank === rank,
    );
  }

  public get size(): number {
    return this.values.length;
  }
}

function normalizeOption<
  TOutcome extends DecisionOutcome,
>(
  option: DecisionOption<TOutcome>,
): DecisionOption<TOutcome> {
  const key = requireText(
    option.key,
    "Decision option key",
  );
  const label = requireText(
    option.label,
    "Decision option label",
  );
  const outcome = requireText(
    option.outcome,
    "Decision option outcome",
  ) as TOutcome;
  const summary = requireText(
    option.summary,
    "Decision option summary",
  );

  if (
    !Number.isInteger(option.rank) ||
    option.rank < 1
  ) {
    throw new RangeError(
      "Decision option rank must be a positive integer.",
    );
  }

  if (
    !Number.isFinite(option.score) ||
    option.score < MINIMUM_SCORE ||
    option.score > MAXIMUM_SCORE
  ) {
    throw new RangeError(
      "Decision option score must be between 0 and 100.",
    );
  }

  return Object.freeze({
    key,
    label,
    outcome,
    rank: option.rank,
    score: option.score,
    summary,
  });
}

function assertContiguousRanks<
  TOutcome extends DecisionOutcome,
>(
  options: readonly DecisionOption<TOutcome>[],
): void {
  const ranks = options
    .map((option) => option.rank)
    .sort((first, second) => first - second);

  for (let index = 0; index < ranks.length; index += 1) {
    if (ranks[index] !== index + 1) {
      throw new RangeError(
        "Decision option ranks must be contiguous and start at 1.",
      );
    }
  }
}

function assertUnique<TValue>(
  values: readonly TValue[],
  message: string,
): void {
  if (new Set(values).size !== values.length) {
    throw new RangeError(message);
  }
}

function requireText(
  value: string,
  field: string,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new TypeError(`${field} cannot be empty.`);
  }

  return normalized;
}
