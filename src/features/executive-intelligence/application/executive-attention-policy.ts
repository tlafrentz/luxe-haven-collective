import type { ExecutiveAttentionItem, ExecutiveAttentionUrgency } from "../domain";

export type ExecutiveAttentionCandidate = Omit<ExecutiveAttentionItem, "rank" | "attentionScore">;

export type ExecutiveAttentionWeights = Readonly<{
  urgency: Readonly<Record<ExecutiveAttentionUrgency, number>>;
  impact: number;
  confidence: number;
  recency: number;
}>;

export const DEFAULT_EXECUTIVE_ATTENTION_WEIGHTS: ExecutiveAttentionWeights = Object.freeze({
  urgency: Object.freeze({ critical: 400, high: 300, medium: 200, low: 100 }),
  impact: 1,
  confidence: 0.5,
  recency: 25,
});

/** Executive-owned, deterministic and independently testable prioritization policy. */
export class ExecutiveAttentionPolicy {
  public constructor(private readonly weights: ExecutiveAttentionWeights = DEFAULT_EXECUTIVE_ATTENTION_WEIGHTS) {}

  public score(candidate: ExecutiveAttentionCandidate, now: Date): number {
    const ageDays = Math.max(0, (now.getTime() - candidate.occurredAt.getTime()) / 86_400_000);
    const recency = Math.max(0, this.weights.recency - ageDays);
    return this.weights.urgency[candidate.urgency]
      + Math.max(0, candidate.impact) * this.weights.impact
      + Math.max(0, Math.min(100, candidate.confidence)) * this.weights.confidence
      + recency;
  }

  public prioritize(candidates: readonly ExecutiveAttentionCandidate[], now: Date, limit = 10): readonly ExecutiveAttentionItem[] {
    if (!Number.isInteger(limit) || limit < 0) throw new RangeError("Executive attention limit must be a non-negative integer.");
    return Object.freeze(candidates
      .map((candidate) => ({ ...candidate, attentionScore: this.score(candidate, now) }))
      .sort((left, right) => right.attentionScore - left.attentionScore || left.sourceId.localeCompare(right.sourceId))
      .slice(0, limit)
      .map((candidate, index) => Object.freeze({ ...candidate, rank: index + 1 })));
  }
}
