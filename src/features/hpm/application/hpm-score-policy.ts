import { Score, ScoreBreakdown, ScoreComponent, Weight } from "@/platform/scoring";

import { HPM_PILLAR_LABELS, type HpmPillar } from "../domain";

export type HpmScorePolicyResult = Readonly<{ score: Score | null; breakdown: ScoreBreakdown | null; dataCoverage: number }>;

/** HPM owns pillar selection and weighting; Platform owns score mechanics. */
export class HpmScorePolicy {
  public constructor(private readonly weights: Readonly<Partial<Record<HpmPillar, number>>> = {}) {}

  public calculate(scores: ReadonlyMap<HpmPillar, Score>): HpmScorePolicyResult {
    const entries = [...scores.entries()];
    const dataCoverage = Math.round(entries.length / 7 * 100);
    if (entries.length === 0) return Object.freeze({ score: null, breakdown: null, dataCoverage });
    const configured = entries.map(([pillar]) => Math.max(0, this.weights[pillar] ?? 1));
    const total = configured.reduce((sum, value) => sum + value, 0);
    if (total === 0) throw new RangeError("HPM score weights must include a positive value for a measured pillar.");
    const components = entries.map(([pillar, score], index) => ScoreComponent.create({
      key: pillar,
      label: HPM_PILLAR_LABELS[pillar],
      description: "Canonical capability score included by HPM aggregation policy.",
      score,
      weight: Weight.create(configured[index] / total),
    }));
    const breakdown = ScoreBreakdown.create({ key: "hpm-score", label: "Hospitality Performance Management score", components });
    return Object.freeze({ score: breakdown.score.round(0), breakdown, dataCoverage });
  }
}
