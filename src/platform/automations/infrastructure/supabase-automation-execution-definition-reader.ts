import {
  type AutomationDefinitionExecutionReader,
} from "../application/automation-governed-execution";
import {
  validateExecutionPlan,
  type AutomationExecutionPlan,
} from "../domain/automation-governed-execution";
import type { AutomationSupabaseClient } from "./supabase-automation-foundation-repository";

const CAPABILITY = "execute";
const COMMAND = "createDraftPlan";
const CONTRACT = "v1";

/** Loads one immutable definition version and derives its execution plan. */
export class SupabaseAutomationExecutionDefinitionReader
  implements AutomationDefinitionExecutionReader
{
  public constructor(
    private readonly client: AutomationSupabaseClient,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  public async getExecution(input: Readonly<{
    tenantId: string;
    automationId: string;
    version: number;
  }>) {
    const [definitionResult, versionResult] = await Promise.all([
      this.client
        .from("automation_definitions")
        .select("*")
        .eq("workspace_id", input.tenantId)
        .eq("id", input.automationId)
        .maybeSingle(),
      this.client
        .from("automation_definition_versions")
        .select("*")
        .eq("workspace_id", input.tenantId)
        .eq("automation_id", input.automationId)
        .eq("version", input.version)
        .maybeSingle(),
    ]);
    if (definitionResult.error || versionResult.error)
      throw new Error("Automation execution definition read failed.");
    const definition = definitionResult.data,
      version = versionResult.data;
    if (!definition || !version) return null;
    if (
      Number(definition.current_version) !== input.version ||
      String(version.automation_id) !== input.automationId ||
      String(version.workspace_id) !== input.tenantId ||
      Number(version.version) !== input.version
    )
      return null;

    const command = record(version.command_specification);
    if (
      command.owningCapability !== CAPABILITY ||
      command.commandType !== COMMAND ||
      command.contractVersion !== CONTRACT
    )
      return null;
    if (
      version.schema_version !== "au001-definition.v1" ||
      version.compatibility !== "compatible"
    )
      return null;

    const propertyIds = strings(version.property_ids);
    if (
      !same(propertyIds, strings(definition.property_ids)) ||
      propertyIds.length === 0
    )
      return null;

    const retry = record(version.retry_policy),
      execution = record(version.execution_policy);
    const plan: AutomationExecutionPlan = validateExecutionPlan({
      version: `au001-execution-plan.v1:${version.id}`,
      schemaVersion: "au001-execution-plan.v1",
      definitionVersionId: String(version.id),
      maximumSteps: Math.min(1, positive(execution.maxFanOut, 1)),
      steps: Object.freeze([
        Object.freeze({
          key: "execute-create-draft-plan",
          owningCapability: CAPABILITY,
          commandType: COMMAND,
          commandContractVersion: CONTRACT,
          dependencies: Object.freeze([]),
          continuationRule: "all_succeeded" as const,
          payload: Object.freeze({
            title: String(version.name),
            description: String(version.description),
            priority: "normal",
          }),
          approvalPolicyId: `approval:${version.id}`,
          actorPolicyId: `actor:${version.id}`,
          retryPolicyId: `retry:${version.id}:${positive(retry.maxAttempts, 1)}`,
          timeoutPolicyId: `timeout:${version.id}:${positive(retry.timeoutMs, 60_000)}`,
          concurrencyGroup: `property:${propertyIds.join(",")}`,
        }),
      ]),
    });
    return Object.freeze({
      definitionVersionId: String(version.id),
      active:
        definition.status === "active" &&
        version.status === "active" &&
        Date.parse(String(version.effective_from)) <= Date.parse(this.clock()) &&
        (!version.valid_until ||
          Date.parse(String(version.valid_until)) > Date.parse(this.clock())),
      killSwitched: false,
      plan,
    });
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}
function same(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length && left.every((value) => right.includes(value))
  );
}
function positive(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
