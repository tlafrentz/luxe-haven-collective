export type ExecutiveAttentionSource = "recommendation" | "action" | "intelligence" | "outcome";
export type ExecutiveAttentionUrgency = "critical" | "high" | "medium" | "low";

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
