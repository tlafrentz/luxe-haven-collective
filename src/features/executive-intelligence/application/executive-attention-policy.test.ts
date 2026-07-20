import { describe, expect, it } from "vitest";

import { ExecutiveAttentionPolicy } from "./executive-attention-policy";

describe("ExecutiveAttentionPolicy", () => {
  const now = new Date("2026-07-19T12:00:00Z");

  it("ranks urgency, impact, confidence, and recency deterministically", () => {
    const policy = new ExecutiveAttentionPolicy();
    const priorities = policy.prioritize([
      { id: "low", source: "recommendation", sourceId: "b", title: "Later", summary: "Lower urgency", category: "revenue", urgency: "low", impact: 100, confidence: 50, occurredAt: now },
      { id: "high", source: "outcome", sourceId: "a", title: "Failure", summary: "Execution failed", category: "operations", urgency: "critical", impact: 0, confidence: 100, occurredAt: now },
    ], now);

    expect(priorities.map((value) => value.id)).toEqual(["high", "low"]);
    expect(priorities.map((value) => value.rank)).toEqual([1, 2]);
  });

  it("uses source identifiers as a stable tie breaker and does not mutate input", () => {
    const candidates = [
      { id: "second", source: "action" as const, sourceId: "z", title: "Z", summary: "Z", category: "ops", urgency: "medium" as const, impact: 0, confidence: 50, occurredAt: now },
      { id: "first", source: "action" as const, sourceId: "a", title: "A", summary: "A", category: "ops", urgency: "medium" as const, impact: 0, confidence: 50, occurredAt: now },
    ];
    const priorities = new ExecutiveAttentionPolicy().prioritize(candidates, now);
    expect(priorities.map((value) => value.id)).toEqual(["first", "second"]);
    expect("rank" in candidates[0]).toBe(false);
  });
});
