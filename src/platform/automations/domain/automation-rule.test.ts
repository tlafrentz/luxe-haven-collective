import { describe, expect, it } from "vitest";
import { AutomationBuilder } from "../application";
import { action, event, rule, rules } from "../automation-fixtures.test-support";
import { AutomationCondition } from "./automation-condition";

describe("AutomationTrigger and AutomationCondition", () => {
  it("matches trigger type and event name", () => {
    expect(rule().trigger.matches(event)).toBe(true);
    expect(rule().trigger.matches({ ...event, name: "rejected" })).toBe(false);
  });
  it("evaluates event and target values independently", () => {
    const confidence = AutomationCondition.create({ source: "event", field: "confidence", operator: "greater-than-or-equal", expected: 0.8 });
    const status = AutomationCondition.create({ source: "action", field: "status", operator: "equals", expected: "accepted" });
    expect(confidence.evaluate({ event })).toBe(true);
    expect(status.evaluate({ event, action: action() })).toBe(true);
  });
  it("validates condition expectations", () => {
    expect(() => AutomationCondition.create({ source: "event", field: "confidence", operator: "equals" })).toThrow("requires an expected value");
  });
});

describe("AutomationRule and AutomationCollection", () => {
  it("normalizes rules, schedule windows, lookup, filtering, and grouping", () => {
    const value = new AutomationBuilder().buildRule({ id: rule().id, title: " Scheduled ", description: " Scheduled work ", trigger: { type: "schedule" },
      target: rule().target, executionPolicy: { notBefore: new Date("2026-07-19T13:00:00Z"), notAfter: new Date("2026-07-19T15:00:00Z"), maxAttempts: 2 },
    });
    const collection = rules(value);
    expect(value.title).toBe("Scheduled");
    expect(value.isScheduledFor(event.occurredAt)).toBe(true);
    expect(collection.require(value.id)).toBe(value);
    expect(collection.enabled().size).toBe(1);
    expect(collection.forTrigger("schedule").size).toBe(1);
    expect(collection.groupByTrigger().get("schedule")?.size).toBe(1);
  });
  it("rejects invalid execution constraints and duplicate rules", () => {
    expect(() => rule({ executionPolicy: { maxAttempts: 0 } })).toThrow("Automation max attempts must be a positive integer.");
    const value = rule();
    expect(() => rules(value, value)).toThrow("Automation rule IDs must be unique.");
  });
});
