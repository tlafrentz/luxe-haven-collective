import { describe, expect, it } from "vitest";
import { SupabaseAutomationExecutionDefinitionReader } from "./supabase-automation-execution-definition-reader";
import { createProductionAutomationPolicyEvaluator } from "./production-automation-policy-evaluator";

const now = "2026-08-10T12:00:00.000Z";
class Query {
  public constructor(private readonly row: Record<string, unknown> | null) {}
  select() { return this; }
  eq() { return this; }
  order() { return this; }
  maybeSingle() { return Promise.resolve({ data: this.row, error: null }); }
  then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: [this.row], error: null }).then(resolve); }
}
class Client {
  public command: Record<string, unknown> = {
    owningCapability: "execute",
    commandType: "createDraftPlan",
    contractVersion: "v1",
  };
  from(table: string) {
    return new Query(table === "automation_definitions" ? {
      id: "automation-1", workspace_id: "workspace-1", status: "active",
      current_version: 1, property_ids: ["property-1"],
    } : {
      id: "definition-version-1", automation_id: "automation-1", workspace_id: "workspace-1", version: 1,
      name: "Create operating plan", description: "Prepare a human-reviewable draft.", status: "active",
      property_ids: ["property-1"], command_specification: this.command,
      retry_policy: { maxAttempts: 2, timeoutMs: 30_000 }, execution_policy: { maxFanOut: 1 },
      schema_version: "au001-definition.v1", compatibility: "compatible",
      effective_from: "2026-08-01T00:00:00.000Z", valid_until: null,
    });
  }
  rpc() { return Promise.resolve({ data: null, error: null }); }
}

describe("production Automation definition and policy composition", () => {
  it("derives one immutable Execute createDraftPlan step", async () => {
    const result = await new SupabaseAutomationExecutionDefinitionReader(new Client() as never, () => now).getExecution({ tenantId: "workspace-1", automationId: "automation-1", version: 1 });
    expect(result).toMatchObject({ active: true, definitionVersionId: "definition-version-1" });
    expect(result?.plan.steps).toEqual([expect.objectContaining({ owningCapability: "execute", commandType: "createDraftPlan", payload: { title: "Create operating plan", description: "Prepare a human-reviewable draft.", priority: "normal" } })]);
  });

  it("rejects unsupported owning-capability commands", async () => {
    const client = new Client(); client.command = { owningCapability: "decide", commandType: "approveDecision", contractVersion: "v1" };
    await expect(new SupabaseAutomationExecutionDefinitionReader(client as never, () => now).getExecution({ tenantId: "workspace-1", automationId: "automation-1", version: 1 })).resolves.toBeNull();
  });

  it("fails policy closed unless tenant, property, definition and command match", async () => {
    const evaluator = createProductionAutomationPolicyEvaluator({ cohort: { tenantId: "workspace-1", propertyIds: ["property-1"], definitionIds: ["automation-1"], commandTypes: ["createDraftPlan"], dispatchEnabled: true, approvalRequired: false, categoricalHalt: false, policyVersion: "policy-v1" }, id: () => "decision-1" });
    const base = { run: { id: "run-1", tenantId: "workspace-1", propertyIds: ["property-1"], automationDefinitionId: "automation-1", automationDefinitionVersionId: "version-1" }, request: { scope: { propertyIds: ["property-1"] } }, plan: { steps: [{ owningCapability: "execute", commandType: "createDraftPlan" }] }, now } as never;
    await expect(evaluator.evaluate(base)).resolves.toMatchObject({ disposition: "permitted_without_additional_approval" });
    const denied = Object.assign({}, base as object, { run: { id: "run-1", tenantId: "other", propertyIds: ["property-1"], automationDefinitionId: "automation-1", automationDefinitionVersionId: "version-1" } }) as never;
    await expect(evaluator.evaluate(denied)).resolves.toMatchObject({ disposition: "prohibited", missingFacts: expect.arrayContaining(["tenant"]) });
  });
});
