import { describe, expect, it } from "vitest";
import { AutomationBuilder } from "../application";
import { event, rule } from "../automation-fixtures.test-support";
import { AutomationHistory } from "./automation-history";

describe("AutomationHistory", () => {
  it("preserves immutable, auditable execution history", () => {
    const execution = new AutomationBuilder().buildExecution({ ruleId: rule().id, trigger: event, startedAt: new Date("2026-07-19T14:00:00Z"), completedAt: new Date("2026-07-19T14:00:01Z"),
      status: "failed", diagnostics: { warnings: [], errors: ["Unavailable"], skippedItems: [], exceptions: ["rule-1"] }, outcome: { successful: false, attempts: 2, message: "Unavailable" },
    });
    const empty = AutomationHistory.empty(), history = empty.append(execution);
    expect(empty.size).toBe(0);
    expect(history.forRule(rule().id).toArray()).toEqual([execution]);
    expect(history.failures().toArray()).toEqual([execution]);
    expect(history.get(execution.id)).toBe(execution);
  });
});
