import { describe, expect, it } from "vitest";
import { Action, ActionCollection, createActionId } from "../../actions";
import { ExecutionStatus } from "../../execution";
import { createWorkflowId } from "../../workflows";
import { actionCollection, event, rule, rules, workflowCollection } from "../automation-fixtures.test-support";
import { createAutomationRuleId } from "../domain";
import { AutomationExecutor, type AutomationInvoker } from "./automation-executor";
import type { AutomationPolicy } from "./automation-policy";
import { AutomationPolicyRegistry } from "./automation-policy-registry";

const allow: AutomationPolicy = { name: "allow", supports: () => true, govern: () => ({ allowed: true, maxAttempts: 3, maxConcurrency: 2 }) };
const policies = AutomationPolicyRegistry.create([allow]);

describe("AutomationExecutor", () => {
  it("evaluates triggers and conditions and initiates a Decision-backed Action", async () => {
    const value = rule({ conditions: [{ source: "event", field: "confidence", operator: "greater-than-or-equal", expected: 0.8 }] });
    const session = await new AutomationExecutor(policies).execute({ event, rules: rules(value), actions: actionCollection(), workflows: workflowCollection() });
    expect(session.status).toBe(ExecutionStatus.COMPLETED);
    expect(session.statistics).toMatchObject({ processed: 1, succeeded: 1, skipped: 0, failed: 0 });
    expect(session.executions.toArray()[0].executedActions.toArray()[0].status).toBe("in-progress");
    expect(session.history.size).toBe(1);
  });

  it("initiates Workflows without executing their Actions", async () => {
    const value = rule({ target: { type: "workflow", id: createWorkflowId("workflow-1") } });
    const execution = (await new AutomationExecutor(policies).execute({ event, rules: rules(value), actions: actionCollection(), workflows: workflowCollection() })).executions.toArray()[0];
    expect(execution.executedWorkflows.toArray()[0].status).toBe("active");
    expect(execution.executedWorkflows.toArray()[0].steps[0].actions.toArray()[0].status).toBe("accepted");
  });

  it.each([
    ["disabled rules", rule({ enabled: false }), "Automation rule is disabled."],
    ["trigger mismatches", rule({ trigger: { type: "manual" } }), "Automation trigger did not match"],
    ["failed conditions", rule({ conditions: [{ source: "event", field: "environment", operator: "equals", expected: "staging" }] }), "Automation conditions were not satisfied."],
    ["out-of-window schedules", rule({ executionPolicy: { notBefore: new Date("2026-07-20T00:00:00Z") } }), "outside the execution window"],
  ])("audits %s as skipped", async (_label, value, reason) => {
    const session = await new AutomationExecutor(policies).execute({ event, rules: rules(value), actions: actionCollection(), workflows: workflowCollection() });
    expect(session.executions.toArray()[0].status).toBe("skipped");
    expect(session.executions.toArray()[0].outcome.message).toContain(reason);
  });

  it("never automates an Action without Decision provenance", async () => {
    const manual = Action.create({
      id: createActionId("action-1"), title: "Manual", summary: "Manual work", type: "publish", priority: "high", status: "accepted",
      owner: { type: "user", id: "user", displayName: "User" }, decisionIds: [], createdAt: new Date(),
    });
    const session = await new AutomationExecutor(policies).execute({ event, rules: rules(rule()), actions: ActionCollection.create([manual]), workflows: workflowCollection() });
    expect(session.executions.toArray()[0].outcome.message).toBe("Automation cannot bypass Decision provenance.");
  });

  it("enforces policy denials", async () => {
    const deny: AutomationPolicy = { name: "deny", supports: () => true, govern: () => ({ allowed: false, reason: "Approval required." }) };
    const session = await new AutomationExecutor(AutomationPolicyRegistry.create([deny])).execute({ event, rules: rules(rule()), actions: actionCollection(), workflows: workflowCollection() });
    expect(session.executions.toArray()[0].status).toBe("skipped");
    expect(session.executions.toArray()[0].outcome.message).toBe("Approval required.");
  });

  it("retries failed invocations up to the governed limit", async () => {
    let attempts = 0;
    const invoker: AutomationInvoker = {
      startAction(action, platformEvent) { attempts += 1; if (attempts < 3) throw new Error("Temporary failure"); return action.start(platformEvent.occurredAt); },
      startWorkflow(value) { return value; },
    };
    const value = rule({ executionPolicy: { maxAttempts: 3 } });
    const execution = (await new AutomationExecutor(policies).execute({ event, rules: rules(value), actions: actionCollection(), workflows: workflowCollection(), invoker })).executions.toArray()[0];
    expect(execution.status).toBe("succeeded"); expect(execution.outcome.attempts).toBe(3); expect(attempts).toBe(3);
  });

  it("records failed executions after retries are exhausted", async () => {
    const invoker: AutomationInvoker = { startAction() { throw new Error("Unavailable"); }, startWorkflow(value) { return value; } };
    const execution = (await new AutomationExecutor(policies).execute({ event, rules: rules(rule({ executionPolicy: { maxAttempts: 2 } })), actions: actionCollection(), workflows: workflowCollection(), invoker })).executions.toArray()[0];
    expect(execution.status).toBe("failed"); expect(execution.outcome).toMatchObject({ attempts: 2, message: "Unavailable" });
  });

  it("enforces concurrency limits while preserving rule order", async () => {
    let active = 0, peak = 0;
    const invoker: AutomationInvoker = {
      async startAction(value, platformEvent) { active += 1; peak = Math.max(peak, active); await Promise.resolve(); active -= 1; return value.start(platformEvent.occurredAt); },
      startWorkflow(value) { return value; },
    };
    const first = rule({ executionPolicy: { maxConcurrency: 1 } });
    const second = rule({ id: createAutomationRuleId("rule-2"), target: { type: "action", id: createActionId("action-2") }, executionPolicy: { maxConcurrency: 2 } });
    const session = await new AutomationExecutor(policies).execute({ event, rules: rules(first, second), actions: actionCollection(2), workflows: workflowCollection(), invoker });
    expect(peak).toBe(1);
    expect(session.executions.toArray().map((execution) => execution.ruleId.value)).toEqual(["rule-1", "rule-2"]);
  });
});
