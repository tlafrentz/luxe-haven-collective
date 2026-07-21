import type { HpmLifecycleProjection } from "@/features/hpm";
import { RecommendationPriority } from "@/platform/recommendations";
import type { ExecutiveAttentionItem, ExecutiveAttentionUrgency } from "../domain";
import { ExecutiveAttentionPolicy, type ExecutiveAttentionCandidate } from "./executive-attention-policy";

export function buildExecutiveAttentionItems(
  lifecycle: HpmLifecycleProjection,
  options: Readonly<{ now?: Date; limit?: number; policy?: ExecutiveAttentionPolicy }> = {},
): readonly ExecutiveAttentionItem[] {
  const now = options.now ?? lifecycle.generatedAt;
  const candidates = collectCandidates(lifecycle);
  return (options.policy ?? new ExecutiveAttentionPolicy()).prioritize(candidates, now, options.limit ?? 10);
}

function collectCandidates(lifecycle: HpmLifecycleProjection): ExecutiveAttentionCandidate[] {
  const recommendations = lifecycle.decide.recommendations.toArray().map((value): ExecutiveAttentionCandidate => ({
    id: `executive-recommendation-${value.id.value}`, source: "recommendation", sourceId: value.id.value,
    title: value.summary, summary: value.rationale.join(" "), category: value.category,
    urgency: recommendationUrgency(value.priority), impact: numericMetadata(value.metadata, ["estimatedAmount", "expectedImpact", "revenueImpact"]),
    confidence: value.confidence.score.value, occurredAt: metadataDate(value.metadata.detectedAt),
  }));
  const actions = lifecycle.execute.actions.toArray()
    .filter((value) => !["completed", "measured", "archived"].includes(value.status))
    .map((value): ExecutiveAttentionCandidate => ({
      id: `executive-action-${value.id.value}`, source: "action", sourceId: value.id.value, title: value.title,
      summary: value.summary, category: value.type, urgency: value.priority,
      impact: numericMetadata(value.metadata, ["estimatedAmount", "expectedImpact"]), confidence: 100, occurredAt: value.createdAt,
    }));
  const intelligence = lifecycle.understand.intelligence.toArray().flatMap((report) => report.artifacts.map((artifact): ExecutiveAttentionCandidate => ({
    id: `executive-intelligence-${artifact.id.value}`, source: "intelligence", sourceId: artifact.id.value,
    title: artifact.title, summary: artifact.summary, category: artifact.kind,
    urgency: artifact.kind === "anomaly" ? "high" : artifact.kind === "opportunity" ? "medium" : "low",
    impact: "expectedImpact" in artifact ? Object.values(artifact.expectedImpact).reduce((total, value) => total + value, 0) : 0,
    confidence: artifact.confidence.score.value, occurredAt: report.reportingPeriod.end,
  })));
  const failures = lifecycle.see.outcomes.toArray().filter((value) => !value.successful).map((value): ExecutiveAttentionCandidate => ({
    id: `executive-outcome-${value.id.value}`, source: "outcome", sourceId: value.id.value, title: value.title,
    summary: value.summary, category: value.type, urgency: value.status === "failed" || value.status === "timed-out" ? "critical" : "high",
    impact: Object.values(value.metrics).reduce((total, metric) => total + Math.abs(metric), 0), confidence: 100,
    occurredAt: value.completedAt ?? value.startedAt,
  }));
  return [...recommendations, ...actions, ...intelligence, ...failures];
}

function recommendationUrgency(value: RecommendationPriority): ExecutiveAttentionUrgency {
  if (value === RecommendationPriority.CRITICAL) return "critical";
  if (value === RecommendationPriority.HIGH) return "high";
  if (value === RecommendationPriority.MEDIUM) return "medium";
  return "low";
}
function numericMetadata(metadata: Readonly<Record<string, unknown>>, keys: readonly string[]): number {
  for (const key of keys) if (typeof metadata[key] === "number") return metadata[key];
  return 0;
}
function metadataDate(value: unknown): Date {
  const date = typeof value === "string" || value instanceof Date ? new Date(value) : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}
