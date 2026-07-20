import { Decision, DecisionMode } from "@/platform/decisions";
import { Identifier } from "@/platform/kernel";
import { RecommendationPriority } from "@/platform/recommendations";

import type { ExecutiveAttentionCandidate, ExecutiveAttentionPolicy } from "../executive-attention-policy";
import { ExecutiveAttentionPolicy as DefaultPolicy } from "../executive-attention-policy";
import type { ExecutiveAttentionUrgency, ExecutiveHealthProjection, ExecutiveProjection } from "../../domain";
import type { ExecutivePlatformInputs } from "./executive-input-adapter";

export type BuildExecutiveProjectionOptions = Readonly<{ now?: Date; limit?: number; policy?: ExecutiveAttentionPolicy }>;

export function buildExecutiveProjection(
  input: ExecutivePlatformInputs,
  options: BuildExecutiveProjectionOptions = {},
): ExecutiveProjection {
  const now = copyDate(options.now ?? new Date());
  const candidates = collectCandidates(input);
  const priorities = (options.policy ?? new DefaultPolicy()).prioritize(candidates, now, options.limit ?? 10);
  const health = buildHealth(input);
  const top = priorities[0];
  const topRecommendation = top?.source === "recommendation"
    ? input.recommendations.toArray().find((value) => value.id.value === top.sourceId)
    : undefined;
  const focusDecision = top
    ? Decision.create({
        id: Identifier.create(`decision-executive-focus-${slug(top.sourceId)}`),
        type: "executive.attention-focus",
        outcome: "focus",
        context: { subjectType: top.source, subjectId: top.sourceId, effectiveAt: now },
        rationale: { summary: `Highest attention score: ${top.attentionScore.toFixed(1)}.`, confidence: topRecommendation?.confidence },
        decidedAt: now,
        title: "Executive focus",
        summary: top.title,
        mode: DecisionMode.AUTOMATIC,
        confidence: topRecommendation?.confidence,
        recommendationIds: topRecommendation ? [topRecommendation.id] : [],
        metadata: { attentionScore: top.attentionScore, source: top.source },
      })
    : undefined;

  return Object.freeze({
    generatedAt: now,
    priorities,
    health,
    briefing: Object.freeze({
      generatedAt: now,
      headline: top ? `${top.title} is the leading priority` : "No immediate priorities require attention",
      summary: `${priorities.length} item${priorities.length === 1 ? "" : "s"} prioritized from canonical Platform records.`,
      recommendedFocus: top?.summary ?? "Continue monitoring Platform Outcomes and Intelligence.",
      highlights: Object.freeze(input.outcomes.toArray().filter((value) => value.successful).slice(0, 3).map((value) => value.summary)),
      concerns: Object.freeze(input.outcomes.toArray().filter((value) => !value.successful).slice(0, 3).map((value) => value.summary)),
    }),
    ...(focusDecision ? { focusDecision } : {}),
  });
}

function collectCandidates(input: ExecutivePlatformInputs): ExecutiveAttentionCandidate[] {
  const recommendations = input.recommendations.toArray().map((value): ExecutiveAttentionCandidate => ({
    id: `executive-recommendation-${value.id.value}`,
    source: "recommendation",
    sourceId: value.id.value,
    title: value.summary,
    summary: value.rationale.join(" "),
    category: value.category,
    urgency: recommendationUrgency(value.priority),
    impact: numericMetadata(value.metadata, ["estimatedAmount", "expectedImpact", "revenueImpact"]),
    confidence: value.confidence.score.value,
    occurredAt: metadataDate(value.metadata.detectedAt),
  }));
  const actions = input.actions.toArray()
    .filter((value) => value.status !== "completed" && value.status !== "measured" && value.status !== "archived")
    .map((value): ExecutiveAttentionCandidate => ({
      id: `executive-action-${value.id.value}`,
      source: "action",
      sourceId: value.id.value,
      title: value.title,
      summary: value.summary,
      category: value.type,
      urgency: value.priority,
      impact: numericMetadata(value.metadata, ["estimatedAmount", "expectedImpact"]),
      confidence: 100,
      occurredAt: value.createdAt,
    }));
  const intelligence = input.intelligence.toArray().flatMap((report) => report.artifacts.map((artifact): ExecutiveAttentionCandidate => ({
    id: `executive-intelligence-${artifact.id.value}`,
    source: "intelligence",
    sourceId: artifact.id.value,
    title: artifact.title,
    summary: artifact.summary,
    category: artifact.kind,
    urgency: artifact.kind === "anomaly" ? "high" : artifact.kind === "opportunity" ? "medium" : "low",
    impact: "expectedImpact" in artifact ? Object.values(artifact.expectedImpact).reduce((total, value) => total + value, 0) : 0,
    confidence: artifact.confidence.score.value,
    occurredAt: report.reportingPeriod.end,
  })));
  const failures = input.outcomes.toArray().filter((value) => !value.successful).map((value): ExecutiveAttentionCandidate => ({
    id: `executive-outcome-${value.id.value}`,
    source: "outcome",
    sourceId: value.id.value,
    title: value.title,
    summary: value.summary,
    category: value.type,
    urgency: value.status === "failed" || value.status === "timed-out" ? "critical" : "high",
    impact: Object.values(value.metrics).reduce((total, metric) => total + Math.abs(metric), 0),
    confidence: 100,
    occurredAt: value.completedAt ?? value.startedAt,
  }));
  return [...recommendations, ...actions, ...intelligence, ...failures];
}

function buildHealth(input: ExecutivePlatformInputs): ExecutiveHealthProjection {
  const outcomes = input.outcomes.toArray();
  const successful = outcomes.filter((value) => value.successful).length;
  const failed = outcomes.length - successful;
  const overall = outcomes.length === 0 ? null : Math.round(successful / outcomes.length * 100);
  const categoryScore = (category: string) => {
    const matching = input.intelligence.toArray().filter((value) => String(value.metadata.capability ?? "").includes(category));
    return matching.length === 0 ? null : Math.round(matching.reduce((total, value) => total + value.confidence.score.value, 0) / matching.length);
  };
  return Object.freeze({ overall, revenue: categoryScore("revenue"), market: categoryScore("market"), investment: categoryScore("investment"), operations: categoryScore("operations"), growth: categoryScore("growth"), successfulOutcomes: successful, failedOutcomes: failed });
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
function metadataDate(value: unknown): Date { const date = typeof value === "string" || value instanceof Date ? new Date(value) : new Date(0); return Number.isNaN(date.getTime()) ? new Date(0) : date; }
function copyDate(value: Date): Date { const date = new Date(value); if (Number.isNaN(date.getTime())) throw new TypeError("Executive projection date must be valid."); return date; }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
