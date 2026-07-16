export type WeightedScore = {
  readonly value: number;
  readonly weight: number;
};

export function clampScore(
  value: number,
): number {
  if (!Number.isFinite(value)) {
    throw new Error(
      "Score must be a finite number.",
    );
  }

  return Math.min(
    Math.max(value, 0),
    100,
  );
}

export function roundScore(
  value: number,
): number {
  return Math.round(
    clampScore(value),
  );
}

export function calculateRatioScore(
  value: number,
  target: number,
): number {
  if (
    !Number.isFinite(target) ||
    target <= 0
  ) {
    throw new Error(
      "Score target must be a finite number greater than zero.",
    );
  }

  return clampScore(
    (value / target) * 100,
  );
}

export function calculateWeightedScore(
  scores: readonly WeightedScore[],
): number {
  if (scores.length === 0) {
    throw new Error(
      "Weighted score requires at least one score.",
    );
  }

  const totalWeight = scores.reduce(
    (total, score) => {
      if (
        !Number.isFinite(score.weight) ||
        score.weight <= 0
      ) {
        throw new Error(
          "Score weights must be finite numbers greater than zero.",
        );
      }

      return total + score.weight;
    },
    0,
  );

  const weightedTotal = scores.reduce(
    (total, score) =>
      total +
      clampScore(score.value) *
        score.weight,
    0,
  );

  return roundScore(
    weightedTotal / totalWeight,
  );
}
