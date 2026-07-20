import type { Decision } from "@/platform/decisions";

export type ExecutiveAttentionSource = "recommendation" | "action" | "intelligence" | "outcome";
export type ExecutiveAttentionUrgency = "critical" | "high" | "medium" | "low";

/** Behavior-free executive projection over canonical Platform artifacts. */
export type ExecutiveAttentionItem = Readonly<{
  id: string;
  rank: number;
  source: ExecutiveAttentionSource;
  sourceId: string;
  title: string;
  summary: string;
  category: string;
  urgency: ExecutiveAttentionUrgency;
  impact: number;
  confidence: number;
  attentionScore: number;
  occurredAt: Date;
}>;

export type ExecutiveHealthProjection = Readonly<{
  overall: number | null;
  revenue: number | null;
  market: number | null;
  investment: number | null;
  operations: number | null;
  growth: number | null;
  successfulOutcomes: number;
  failedOutcomes: number;
}>;

export type ExecutiveBriefingProjection = Readonly<{
  generatedAt: Date;
  headline: string;
  summary: string;
  recommendedFocus: string;
  highlights: readonly string[];
  concerns: readonly string[];
}>;

export type ExecutiveProjection = Readonly<{
  generatedAt: Date;
  priorities: readonly ExecutiveAttentionItem[];
  health: ExecutiveHealthProjection;
  briefing: ExecutiveBriefingProjection;
  focusDecision?: Decision<"focus">;
}>;
