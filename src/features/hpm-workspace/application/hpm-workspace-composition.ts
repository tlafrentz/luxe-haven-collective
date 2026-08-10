import { randomUUID } from "node:crypto";
import { getCurrentHpmCanonicalInputs } from "@/features/hpm";
import { SupabaseTeamAccessRepository, type WorkspaceAccessContext } from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";
import {
  createHpmAttentionProjectionService,
  createHpmLifecycleProjectionService,
  createHpmProjectionSourcePort,
  createHpmSourcePortRegistry,
  createUnavailableHpmSourcePort,
  HPM_ATTENTION_POLICY_VERSION,
  HPM_COMMAND_VOCABULARY_VERSION,
  HPM_FRESHNESS_POLICY_VERSION,
  HPM_HEALTH_POLICY_VERSION,
  HPM_LIFECYCLE_POLICY_VERSION,
  HPM_LINEAGE_POLICY_VERSION,
  evaluateHpmFeatureFlags,
  evaluateHpmCohortAccess,
  type HpmActorContext,
  type HpmAttentionProjection,
  type HpmLifecycleProjection,
  type HpmProjectedRecord,
  type HpmProjectionScope,
} from "@/platform/hpm";
import type { HpmWorkspaceQuery } from "./hpm-workspace-context";

export type HpmWorkspaceProjection = Readonly<{
  lifecycle: HpmLifecycleProjection;
  attention: HpmAttentionProjection;
  properties: readonly Readonly<{ id: string; name: string }>[];
  correlationId: string;
  actor: HpmActorContext;
  features: Readonly<{ reports: boolean; exports: boolean; operationalHealth: boolean; operationalCommands: boolean }>;
}>;

export type HpmWorkspaceFailure = Readonly<{ ok: false; code: string; message: string; correlationId: string }>;
export type HpmWorkspaceResult = Readonly<{ ok: true; value: HpmWorkspaceProjection } | HpmWorkspaceFailure>;

export function isHpmWorkspaceEnabled() {
  return getHpmRuntimeFlags().workspace;
}

export function getHpmRuntimeFlags() { return evaluateHpmFeatureFlags({ requested: { workspace: process.env.HPM_UNIFIED_WORKSPACE_ENABLED === "true", lifecycle: process.env.HPM_LIFECYCLE_PROJECTION_ENABLED === "true", attention: process.env.HPM_ATTENTION_QUEUE_ENABLED === "true", "command-routing": process.env.HPM_COMMAND_ROUTING_ENABLED === "true", reporting: process.env.HPM_STANDARD_REPORTS_ENABLED === "true", operations: process.env.HPM_OPERATIONAL_HEALTH_ENABLED === "true", learn: process.env.HPM_LEARN_INTEGRATION_ENABLED === "true", recommend: process.env.HPM_RECOMMEND_INTEGRATION_ENABLED === "true" }, killSwitches: { workspace: process.env.HPM_WORKSPACE_KILL_SWITCH === "true", lifecycle: process.env.HPM_LIFECYCLE_KILL_SWITCH === "true", attention: process.env.HPM_ATTENTION_KILL_SWITCH === "true", "command-routing": process.env.HPM_COMMAND_ROUTING_KILL_SWITCH === "true", reporting: process.env.HPM_REPORTING_KILL_SWITCH === "true", operations: process.env.HPM_OPERATIONS_KILL_SWITCH === "true", learn: process.env.HPM_LEARN_KILL_SWITCH === "true", recommend: process.env.HPM_RECOMMEND_KILL_SWITCH === "true" } }); }

export function getHpmReportingFlags() { const flags = getHpmRuntimeFlags(); return Object.freeze({ reports: flags.reporting, exports: flags.reporting && process.env.HPM_REPORT_EXPORTS_ENABLED === "true" && process.env.HPM_EXPORTS_KILL_SWITCH !== "true", operationalHealth: flags.operations, operationalCommands: flags.operations && process.env.HPM_OPERATIONAL_COMMANDS_ENABLED === "true" && process.env.HPM_OPERATIONAL_COMMANDS_KILL_SWITCH !== "true" }); }

/** Server-only production composition. RLS-filtered sources are adapted into HPM; absent sources stay explicitly unavailable. */
export async function getHpmWorkspaceProjection(query: HpmWorkspaceQuery): Promise<HpmWorkspaceResult> {
  const correlationId = randomUUID();
  if (!isHpmWorkspaceEnabled()) return { ok: false, code: "HPM_FEATURE_DISABLED", message: "The HPM workspace is not enabled for this environment.", correlationId };
  try {
    const { user, profile } = await requireUser();
    const repository = new SupabaseTeamAccessRepository();
    const access = await repository.resolve(user.id);
    if (!access || access.status !== "active") return { ok: false, code: "HPM_SCOPE_ACCESS_DENIED", message: "This HPM workspace is not available to your account.", correlationId };
    const listed = await repository.properties(access);
    const allowed = access.propertyAccess.type === "selected" ? new Set(access.propertyAccess.propertyIds) : null;
    const properties = Object.freeze(listed.filter((property) => !allowed || allowed.has(property.id)).map((property) => Object.freeze(property)));
    const actor: HpmActorContext = Object.freeze({ actorId: user.id, tenantId: access.workspaceId, roleIds: [access.role], propertyIds: properties.map(({ id }) => id), active: true });
    const cohort = process.env.HPM_ROLLOUT_COHORT ?? "verification";
    const eligible = evaluateHpmCohortAccess({ cohort: isHpmCohort(cohort) ? cohort : "verification", enabled: process.env.HPM_COHORT_ENABLED === "true", profileRole: profile?.role, tenantId: access.workspaceId, namedTenantIds: parseTenantIds(process.env.HPM_COHORT_TENANT_IDS) });
    if (!eligible) return { ok: false, code: "HPM_COHORT_INELIGIBLE", message: "The HPM workspace is not enabled for this account cohort.", correlationId };
    const scopeId = query.scopeType === "property" ? query.scopeId : access.workspaceId;
    if (!scopeId) return { ok: false, code: "HPM_SCOPE_NOT_FOUND", message: "Choose an authorized property to view its lifecycle.", correlationId };
    const scope = resolveScope(access, properties, query, scopeId);
    if (!scope) return { ok: false, code: "HPM_SCOPE_ACCESS_DENIED", message: "The requested HPM scope is unavailable.", correlationId };
    const runtimeFlags = getHpmRuntimeFlags();
    if (!runtimeFlags.lifecycle) return { ok: false, code: "HPM_FEATURE_DISABLED", message: "The HPM lifecycle projection is not enabled for this cohort.", correlationId };
    const observe = createHpmProjectionSourcePort({ capability: "observations", contractVersion: "v1", project: async () => {
      const assembly = await getCurrentHpmCanonicalInputs({ startDate: query.from, endDate: query.to, propertyId: query.scopeType === "property" ? scopeId : undefined, generatedAt: query.asOf });
      const records = assembly.context.analytics.metricProjections.map((metric, index): HpmProjectedRecord => Object.freeze({
        tenantId: access.workspaceId,
        source: Object.freeze({ capability: "observations", recordType: "analytics-metric", recordId: `${metric.metric}:${metric.scope.id}`, recordVersion: metric.calculationVersion }),
        stage: "see", canonicalStatus: "observed", presentationState: "completed",
        summary: `${metric.label} is available for the selected reporting period.`,
        propertyIds: metric.scope.type === "property" ? [metric.scope.id] : scope.propertyIds,
        portfolioId: query.scopeType === "portfolio" ? access.workspaceId : undefined,
        attentionState: "none", validNextCommands: [], createdAt: metric.measuredAt, updatedAt: metric.measuredAt,
        canonicalThreadId: `analytics:${metric.metric}:${metric.scope.id}:${index}`, visibility: "tenant",
      }));
      return Object.freeze({ state: Object.freeze({ capability: "observations" as const, contractVersion: "v1", freshness: "current" as const, asOf: query.asOf, observedAt: query.asOf, lastSuccessfulAsOf: query.asOf, sourceVersion: assembly.context.analytics.generatedAt, policyVersion: "analytics-hpm-adapter-v1", contributesToCounts: true, contributesToHealth: true, contributesToLineage: true }), records: Object.freeze(records) });
    }});
    const sources = createHpmSourcePortRegistry([observe, ...(["intelligence", "decisions", "execute", "outcomes", "learning", "recommendations"] as const).map((capability) => createUnavailableHpmSourcePort(capability, "not-configured"))]);
    const lifecycleService = createHpmLifecycleProjectionService({ sources, scopeAuthorizer: { resolve: async () => ({ ok: true as const, scope }) } });
    const lifecycle = await lifecycleService.buildHpmLifecycleProjection({ actor, scopeType: query.scopeType, scopeId, asOf: query.asOf, correlationId, policyVersions: { lifecycle: HPM_LIFECYCLE_POLICY_VERSION, health: HPM_HEALTH_POLICY_VERSION, lineage: HPM_LINEAGE_POLICY_VERSION, freshness: HPM_FRESHNESS_POLICY_VERSION } });
    if (!lifecycle.ok) return { ok: false, code: lifecycle.code, message: lifecycle.message, correlationId };
    const attentionService = createHpmAttentionProjectionService();
    const attention = await attentionService.buildHpmAttentionProjection({ actor, lifecycleProjection: lifecycle.projection, attentionPolicyVersion: HPM_ATTENTION_POLICY_VERSION, commandVocabularyVersion: HPM_COMMAND_VOCABULARY_VERSION, correlationId, cursor: query.cursor, filter: { stages: query.stages, classifications: query.classifications } });
    if (!attention.ok) return { ok: false, code: attention.code, message: attention.message, correlationId };
    return { ok: true, value: Object.freeze({ lifecycle: lifecycle.projection, attention: attention.projection, properties, correlationId, actor, features: getHpmReportingFlags() }) };
  } catch {
    return { ok: false, code: "HPM_PROJECTION_UNAVAILABLE", message: "The HPM workspace could not be loaded. No source records were changed.", correlationId };
  }
}

function parseTenantIds(value?: string) { return Object.freeze((value ?? "").split(",").map((item) => item.trim()).filter(Boolean)); }
function isHpmCohort(value: string): value is "verification" | "internal" | "named-test-tenants" | "limited" | "broad" | "general-availability" { return ["verification", "internal", "named-test-tenants", "limited", "broad", "general-availability"].includes(value); }

function resolveScope(access: WorkspaceAccessContext, properties: readonly { id: string }[], query: HpmWorkspaceQuery, scopeId: string): HpmProjectionScope | null {
  if (query.scopeType === "property" && !properties.some(({ id }) => id === scopeId)) return null;
  return Object.freeze({ tenantId: access.workspaceId, type: query.scopeType, ...(query.scopeType === "portfolio" ? { portfolioId: access.workspaceId } : {}), propertyIds: query.scopeType === "property" ? [scopeId] : properties.map(({ id }) => id), timeZone: "America/Chicago", from: `${query.from}T00:00:00.000Z`, to: `${query.to}T23:59:59.999Z` });
}
