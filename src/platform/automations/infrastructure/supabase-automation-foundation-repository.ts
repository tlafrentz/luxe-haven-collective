import type { AutomationActivityEvent, AutomationDefinitionRepository, AutomationNotificationIntent } from "../application/automation-foundation";
import type { AutomationDefinition, AutomationDefinitionVersion } from "../domain/automation-definition";
import { AutomationFoundationError } from "../domain/automation-definition";

type Result<T> = PromiseLike<Readonly<{ data: T; error: Readonly<{ code?: string; message: string }> | null }>>;
export interface AutomationSupabaseQuery {
  select(columns?: string): AutomationSupabaseQuery;
  eq(column: string, value: unknown): AutomationSupabaseQuery;
  order(column: string, options?: Readonly<{ ascending: boolean }>): AutomationSupabaseQuery;
  maybeSingle(): Result<Record<string, unknown> | null>;
  then<TResult1 = Readonly<{ data: unknown; error: Readonly<{ code?: string; message: string }> | null }>, TResult2 = never>(onfulfilled?: ((value: Readonly<{ data: unknown; error: Readonly<{ code?: string; message: string }> | null }>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2>;
}
export interface AutomationSupabaseClient {
  from(table: string): AutomationSupabaseQuery;
  rpc(name: string, parameters: Readonly<Record<string, unknown>>): Result<unknown>;
}

export class SupabaseAutomationFoundationRepository implements AutomationDefinitionRepository {
  public constructor(private readonly client: AutomationSupabaseClient) {}

  public async get(tenantId: string, automationId: string) {
    const definitionResult = await this.client.from("automation_definitions").select("*").eq("workspace_id", tenantId).eq("id", automationId).maybeSingle();
    if (definitionResult.error) throw new Error("Automation definition read failed.");
    if (!definitionResult.data) return null;
    const versionResult = await this.client.from("automation_definition_versions").select("*").eq("workspace_id", tenantId).eq("automation_id", automationId).eq("version", Number(definitionResult.data.current_version)).maybeSingle();
    if (versionResult.error || !versionResult.data) throw new Error("Automation version read failed.");
    return Object.freeze({ definition: mapDefinition(definitionResult.data), current: mapVersion(versionResult.data) });
  }

  public async list(tenantId: string) {
    const result = await this.client.from("automation_definitions").select("*").eq("workspace_id", tenantId).order("created_at", { ascending: false });
    if (result.error) throw new Error("Automation definition list failed.");
    const rows = Array.isArray(result.data) ? result.data as Record<string, unknown>[] : [];
    const values = await Promise.all(rows.map((row) => this.get(tenantId, String(row.id))));
    return Object.freeze(values.filter((value): value is NonNullable<typeof value> => value !== null));
  }

  public async create(input: Readonly<{ definition: AutomationDefinition; version: AutomationDefinitionVersion; activity: AutomationActivityEvent }>) {
    await this.save(input.definition, input.version, input.activity, undefined, null);
  }

  public async appendVersion(input: Readonly<{ expectedVersion: number; definition: AutomationDefinition; version: AutomationDefinitionVersion; activity: AutomationActivityEvent; notification?: AutomationNotificationIntent }>) {
    await this.save(input.definition, input.version, input.activity, input.notification, input.expectedVersion);
  }

  private async save(definition: AutomationDefinition, version: AutomationDefinitionVersion, activity: AutomationActivityEvent, notification: AutomationNotificationIntent | undefined, expectedVersion: number | null) {
    const result = await this.client.rpc("save_automation_definition", { p_definition: persistDefinition(definition, version.configuration.scope.propertyIds), p_version: persistVersion(version), p_activity: persistActivity(activity), p_notification: notification ? persistNotification(notification) : null, p_expected_version: expectedVersion });
    if (!result.error) return;
    if (result.error.code === "40001") throw new AutomationFoundationError("AUTOMATION_VERSION_CONFLICT", "Automation changed after it was loaded.");
    if (result.error.code === "42501") throw new AutomationFoundationError("AUTOMATION_ACCESS_DENIED", "Automation access is denied.");
    throw new Error("Automation persistence failed.");
  }
}

function persistDefinition(value: AutomationDefinition, propertyIds: readonly string[]) { return { id: value.id, workspace_id: value.tenantId, status: value.status, current_version: value.currentVersion, aggregate_version: value.version, property_ids: propertyIds, created_by_profile_id: value.createdBy, created_at: value.createdAt, activated_by_profile_id: value.activatedBy ?? null, activated_at: value.activatedAt ?? null, paused_by_profile_id: value.pausedBy ?? null, paused_at: value.pausedAt ?? null, retired_by_profile_id: value.retiredBy ?? null, retired_at: value.retiredAt ?? null, archived_by_profile_id: value.archivedBy ?? null, archived_at: value.archivedAt ?? null }; }
function persistVersion(value: AutomationDefinitionVersion) { const c = value.configuration; return { id: value.id, automation_id: value.automationId, workspace_id: value.tenantId, version: value.version, name: value.name, description: value.description, status: value.status, template_origin: value.templateOrigin ?? null, scope_type: c.scope.type, property_ids: c.scope.propertyIds, owner_profile_id: c.ownerId, operational_steward_profile_id: c.operationalStewardId ?? null, trigger_specification: c.trigger, condition_specifications: c.conditions, exclusion_specifications: c.exclusions, command_specification: c.command, approval_policy: c.approval, execution_policy: c.execution, retry_policy: c.retry, notification_policy: c.notification, effective_from: c.effectiveFrom, valid_until: c.validUntil ?? null, schema_version: value.schemaVersion, policy_version: value.policyVersion, compatibility: value.compatibility, created_by_profile_id: value.createdBy, created_at: value.createdAt, reason: value.reason }; }
function persistActivity(value: AutomationActivityEvent) { return { id: value.id, workspace_id: value.tenantId, automation_id: value.automationId, definition_version: value.definitionVersion, event_type: value.eventType, actor_profile_id: value.actorId, occurred_at: value.occurredAt, correlation_id: value.correlationId, causation_id: value.causationId ?? null, safe_metadata: value.safeMetadata }; }
function persistNotification(value: AutomationNotificationIntent) { return { id: value.id, recipient_id: value.recipientId, event_type: value.eventType, idempotency_key: value.idempotencyKey, safe_template_variables: value.safeTemplateVariables, created_at: value.createdAt }; }
function mapDefinition(row: Record<string, unknown>): AutomationDefinition { return Object.freeze({ id: String(row.id), tenantId: String(row.workspace_id), status: row.status as AutomationDefinition["status"], currentVersion: Number(row.current_version), version: Number(row.aggregate_version), createdBy: String(row.created_by_profile_id), createdAt: String(row.created_at), ...(row.activated_by_profile_id ? { activatedBy: String(row.activated_by_profile_id), activatedAt: String(row.activated_at) } : {}), ...(row.paused_by_profile_id ? { pausedBy: String(row.paused_by_profile_id), pausedAt: String(row.paused_at) } : {}), ...(row.retired_by_profile_id ? { retiredBy: String(row.retired_by_profile_id), retiredAt: String(row.retired_at) } : {}), ...(row.archived_by_profile_id ? { archivedBy: String(row.archived_by_profile_id), archivedAt: String(row.archived_at) } : {}) }); }
function mapVersion(row: Record<string, unknown>): AutomationDefinitionVersion { const trigger = object(row.trigger_specification), command = object(row.command_specification), approval = object(row.approval_policy), execution = object(row.execution_policy), retry = object(row.retry_policy), notification = object(row.notification_policy); return Object.freeze({ id: String(row.id), automationId: String(row.automation_id), tenantId: String(row.workspace_id), version: Number(row.version), name: String(row.name), description: String(row.description), status: row.status as AutomationDefinitionVersion["status"], ...(row.template_origin ? { templateOrigin: String(row.template_origin) } : {}), configuration: Object.freeze({ scope: Object.freeze({ type: row.scope_type as AutomationDefinitionVersion["configuration"]["scope"]["type"], propertyIds: Object.freeze(strings(row.property_ids)) }), ownerId: String(row.owner_profile_id), ...(row.operational_steward_profile_id ? { operationalStewardId: String(row.operational_steward_profile_id) } : {}), trigger: trigger as AutomationDefinitionVersion["configuration"]["trigger"], conditions: Object.freeze(records(row.condition_specifications)), exclusions: Object.freeze(records(row.exclusion_specifications)), command: command as AutomationDefinitionVersion["configuration"]["command"], approval: approval as AutomationDefinitionVersion["configuration"]["approval"], execution: execution as AutomationDefinitionVersion["configuration"]["execution"], retry: retry as AutomationDefinitionVersion["configuration"]["retry"], notification: notification as AutomationDefinitionVersion["configuration"]["notification"], effectiveFrom: String(row.effective_from), ...(row.valid_until ? { validUntil: String(row.valid_until) } : {}) }), schemaVersion: "au001-definition.v1", policyVersion: "au001-foundation.v1", compatibility: row.compatibility as AutomationDefinitionVersion["compatibility"], createdBy: String(row.created_by_profile_id), createdAt: String(row.created_at), reason: String(row.reason) }); }
function object(value: unknown): Readonly<Record<string, unknown>> { return value && typeof value === "object" && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {}; }
function records(value: unknown): readonly Readonly<Record<string, unknown>>[] { return Array.isArray(value) ? value.map(object) : []; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.map(String) : []; }
