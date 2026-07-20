import { describe, expect, it } from "vitest";
import { ActionCollection } from "../../actions";
import { AutomationBuilder, AutomationHistory, createAutomationExecutionId, createAutomationRuleId } from "../../automations";
import { ExecutionStatus } from "../../execution";
import { Identifier } from "../../kernel";
import { WorkflowCollection } from "../../workflows";
import { collections, lineage, policy } from "../outcome-fixtures.test-support";
import type { OutcomePolicy } from "./outcome-policy";
import { OutcomeExecutor } from "./outcome-executor";
import { OutcomePolicyRegistry } from "./outcome-policy-registry";

describe("OutcomeExecutor", () => {
  it("resolves policies and constructs Outcomes for completed execution artifacts", async () => {
    const session = await new OutcomeExecutor(OutcomePolicyRegistry.create([policy])).execute({
      actions: collections.actions(), workflows: collections.workflows(), automations: collections.automations(), metadata: { batch: "daily" },
    });
    expect(session.status).toBe(ExecutionStatus.COMPLETED);
    expect(session.outcomes.size).toBe(3);
    expect(session.outcomes.toArray().map((value) => value.type)).toEqual(["action-outcome", "workflow-outcome", "automation-outcome"]);
    expect(session.statistics).toMatchObject({ processed: 3, succeeded: 3, skipped: 0, failed: 0 });
    expect(session.metadata).toEqual({ batch: "daily" });
  });

  it("records failed Automation executions as failed Outcomes", async () => {
    const failed = new AutomationBuilder().buildExecution({ id: createAutomationExecutionId("automation-failed"), ruleId: createAutomationRuleId("rule-failed"),
      trigger: { type: "manual", occurredAt: new Date("2026-07-19T10:00:00Z") }, startedAt: new Date("2026-07-19T10:00:00Z"), completedAt: new Date("2026-07-19T10:01:00Z"), status: "failed",
      diagnostics: { warnings: [], errors: ["API unavailable"], skippedItems: [], exceptions: ["rule-failed"] }, outcome: { successful: false, attempts: 2, message: "API unavailable" },
    });
    const failurePolicy: OutcomePolicy = { name: "failure", supports: ({ source }) => source.type === "automation",
      measure: () => ({ title: "Automation failure", summary: "Execution failed.", status: "failed", successful: false,
        result: { error: "API unavailable" }, lineage: { ...lineage(), actionIds: [Identifier.create("action-attempted")], decisionIds: [Identifier.create("decision-1")] },
      }),
    };
    const session = await new OutcomeExecutor(OutcomePolicyRegistry.create([failurePolicy])).execute({
      actions: ActionCollection.empty(), workflows: WorkflowCollection.empty(), automations: AutomationHistory.create([failed]),
    });
    const outcome = session.outcomes.toArray()[0];
    expect(outcome.status).toBe("failed"); expect(outcome.successful).toBe(false);
    expect(outcome.result).toEqual({ error: "API unavailable" }); expect(outcome.lineage.automationExecutionIds[0].value).toBe("automation-failed");
  });

  it("diagnoses unsupported sources without fabricating Outcomes", async () => {
    const session = await new OutcomeExecutor(OutcomePolicyRegistry.empty()).execute({
      actions: collections.actions(), workflows: WorkflowCollection.empty(), automations: AutomationHistory.empty(),
    });
    expect(session.status).toBe(ExecutionStatus.COMPLETED_WITH_WARNINGS); expect(session.outcomes.isEmpty).toBe(true);
    expect(session.statistics.skipped).toBe(1); expect(session.diagnostics.warnings[0]).toContain("No Outcome policy supports Action");
  });

  it("isolates policy and builder failures as execution diagnostics", async () => {
    const invalid: OutcomePolicy = { name: "invalid", supports: () => true, measure: () => ({ title: "Invalid", summary: "Missing lineage", status: "completed", successful: true,
      lineage: { automationExecutionIds: [], workflowIds: [], actionIds: [], decisionIds: [], recommendationIds: [], evaluationIds: [], claimIds: [], evidenceIds: [], observationIds: [] },
    }) };
    const session = await new OutcomeExecutor(OutcomePolicyRegistry.create([invalid])).execute({ actions: collections.actions(), workflows: WorkflowCollection.empty(), automations: AutomationHistory.empty() });
    expect(session.status).toBe(ExecutionStatus.FAILED); expect(session.statistics.failed).toBe(1); expect(session.diagnostics.errors[0]).toContain("Outcome lineage is incomplete");
  });
});
