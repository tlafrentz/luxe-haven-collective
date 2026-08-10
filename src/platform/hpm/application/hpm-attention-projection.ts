import { createHash } from "node:crypto";
import type { HpmAttentionClassification, HpmAttentionItem, HpmLifecycleProjection } from "./hpm-contracts";
import type { HpmActorContext } from "./hpm-source-ports";
import { HPM_ATTENTION_POLICY_VERSION, projectHpmAttentionItems } from "./hpm-attention-policy";
import { HPM_COMMAND_VOCABULARY_VERSION, projectHpmValidCommands, type HpmCommandRouteRegistry } from "./hpm-command-routing";
import type { HpmLifecycleStage, HpmSourceCapability } from "./hpm-vocabulary";

const DEFAULT_PAGE_SIZE = 50, MAX_PAGE_SIZE = 100;

export type HpmAttentionFilter = Readonly<{ stages?: readonly HpmLifecycleStage[]; capabilities?: readonly HpmSourceCapability[]; classifications?: readonly HpmAttentionClassification[] }>;
export type HpmAttentionProjectionRequest = Readonly<{
  actor: HpmActorContext;
  lifecycleProjection: HpmLifecycleProjection;
  attentionPolicyVersion: string;
  commandVocabularyVersion: string;
  correlationId: string;
  cursor?: string;
  limit?: number;
  filter?: HpmAttentionFilter;
}>;
export type HpmAttentionProjection = Readonly<{
  projectionKey: string;
  scope: HpmLifecycleProjection["scope"];
  asOf: string;
  policyVersions: Readonly<{ lifecycle: string; attention: string; command: string }>;
  completeness: HpmLifecycleProjection["completeness"];
  totalAuthorizedCandidates: number;
  items: readonly HpmAttentionItem[];
  groups: Readonly<{ byStage: Readonly<Record<string, number>>; byCapability: Readonly<Record<string, number>>; byClassification: Readonly<Record<string, number>> }>;
  sourceStates: HpmLifecycleProjection["sourceStates"];
  failures: HpmLifecycleProjection["failures"];
  projectedAt: string;
  pagination: Readonly<{ limit: number; returned: number; hasMore: boolean; nextCursor?: string }>;
}>;
export type HpmAttentionProjectionResult = Readonly<{ ok: true; projection: HpmAttentionProjection } | { ok: false; code: "HPM_ATTENTION_POLICY_UNSUPPORTED" | "HPM_COMMAND_NOT_SUPPORTED" | "HPM_COMMAND_INPUT_INVALID"; message: string }>;

export interface HpmAttentionTelemetry { emit(event: Readonly<{ name: string; correlationId: string; scopeType: string; count?: number; classification?: string }>): void; }

export function createHpmAttentionProjectionService(dependencies: Readonly<{ telemetry?: HpmAttentionTelemetry; now?: () => string; routes?: HpmCommandRouteRegistry }> = {}) {
  return Object.freeze({
    async buildHpmAttentionProjection(request: HpmAttentionProjectionRequest): Promise<HpmAttentionProjectionResult> {
      dependencies.telemetry?.emit({ name: "hpm_attention_projection_started", correlationId: request.correlationId, scopeType: request.lifecycleProjection.scope.type });
      if (request.attentionPolicyVersion !== HPM_ATTENTION_POLICY_VERSION) return fail("HPM_ATTENTION_POLICY_UNSUPPORTED", "The attention policy version is unsupported.", request, dependencies);
      if (request.commandVocabularyVersion !== HPM_COMMAND_VOCABULARY_VERSION) return fail("HPM_COMMAND_NOT_SUPPORTED", "The command vocabulary version is unsupported.", request, dependencies);
      if (!request.actor.active || request.actor.tenantId !== request.lifecycleProjection.scope.tenantId || request.lifecycleProjection.scope.propertyIds.some((propertyId) => !request.actor.propertyIds.includes(propertyId))) return fail("HPM_COMMAND_INPUT_INVALID", "The attention request is invalid.", request, dependencies);
      const all = projectHpmAttentionItems(request.lifecycleProjection);
      dependencies.telemetry?.emit({ name: "hpm_attention_candidates_extracted", correlationId: request.correlationId, scopeType: request.lifecycleProjection.scope.type, count: all.length });
      const filtered = applyFilter(all, request.filter);
      const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, request.limit ?? DEFAULT_PAGE_SIZE));
      const offset = decodeCursor(request.cursor, cursorIdentity(request.lifecycleProjection, request.filter));
      if (offset === null) return fail("HPM_COMMAND_INPUT_INVALID", "The attention cursor is invalid.", request, dependencies);
      const page = filtered.slice(offset, offset + limit).map((item) => {
        const freshness = request.lifecycleProjection.sourceStates.find(({ capability }) => capability === item.authoritativeRecord.capability)?.freshness ?? "unavailable";
        const commands = dependencies.routes ? projectHpmValidCommands({ descriptors: item.validNextCommands ?? [], actor: request.actor, sourceFreshness: freshness, registeredRoutes: dependencies.routes }) : [];
        return Object.freeze({ ...item, validNextCommands: commands, primaryNextCommand: commands[0] });
      }), hasMore = offset + limit < filtered.length;
      const projection: HpmAttentionProjection = Object.freeze({
        projectionKey: projectionKey(request.lifecycleProjection, request.filter),
        scope: request.lifecycleProjection.scope,
        asOf: request.lifecycleProjection.asOf,
        policyVersions: Object.freeze({ lifecycle: request.lifecycleProjection.projectionPolicyVersion, attention: HPM_ATTENTION_POLICY_VERSION, command: HPM_COMMAND_VOCABULARY_VERSION }),
        completeness: request.lifecycleProjection.completeness,
        totalAuthorizedCandidates: filtered.length,
        items: Object.freeze(page),
        groups: groupItems(filtered),
        sourceStates: request.lifecycleProjection.sourceStates,
        failures: request.lifecycleProjection.failures,
        projectedAt: dependencies.now?.() ?? request.lifecycleProjection.projectedAt,
        pagination: Object.freeze({ limit, returned: page.length, hasMore, nextCursor: hasMore ? encodeCursor(offset + limit, cursorIdentity(request.lifecycleProjection, request.filter)) : undefined }),
      });
      dependencies.telemetry?.emit({ name: request.lifecycleProjection.partial ? "hpm_attention_projection_partial" : "hpm_attention_projection_completed", correlationId: request.correlationId, scopeType: request.lifecycleProjection.scope.type, count: filtered.length, classification: request.lifecycleProjection.completeness });
      return Object.freeze({ ok: true, projection });
    },
  });
}

function applyFilter(items: readonly HpmAttentionItem[], filter?: HpmAttentionFilter) { return items.filter((item) => (!filter?.stages?.length || filter.stages.includes(item.stage)) && (!filter?.capabilities?.length || filter.capabilities.includes(item.authoritativeRecord.capability)) && (!filter?.classifications?.length || (item.classification && filter.classifications.includes(item.classification)))); }
function groupItems(items: readonly HpmAttentionItem[]) { const byStage: Record<string, number> = {}, byCapability: Record<string, number> = {}, byClassification: Record<string, number> = {}; for (const item of items) { byStage[item.stage] = (byStage[item.stage] ?? 0) + 1; byCapability[item.authoritativeRecord.capability] = (byCapability[item.authoritativeRecord.capability] ?? 0) + 1; if (item.classification) byClassification[item.classification] = (byClassification[item.classification] ?? 0) + 1; } return Object.freeze({ byStage: Object.freeze(byStage), byCapability: Object.freeze(byCapability), byClassification: Object.freeze(byClassification) }); }
function cursorIdentity(projection: HpmLifecycleProjection, filter?: HpmAttentionFilter) { return createHash("sha256").update(JSON.stringify({ id: projection.projectionId, asOf: projection.asOf, policy: HPM_ATTENTION_POLICY_VERSION, filter })).digest("hex").slice(0, 16); }
function projectionKey(projection: HpmLifecycleProjection, filter?: HpmAttentionFilter) { return `hpm-attention:${cursorIdentity(projection, filter)}`; }
function encodeCursor(offset: number, identity: string) { return Buffer.from(JSON.stringify({ offset, identity })).toString("base64url"); }
function decodeCursor(cursor: string | undefined, identity: string): number | null { if (!cursor) return 0; try { const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { offset?: unknown; identity?: unknown }; return Number.isInteger(value.offset) && Number(value.offset) >= 0 && value.identity === identity ? Number(value.offset) : null; } catch { return null; } }
function fail(code: "HPM_ATTENTION_POLICY_UNSUPPORTED" | "HPM_COMMAND_NOT_SUPPORTED" | "HPM_COMMAND_INPUT_INVALID", message: string, request: HpmAttentionProjectionRequest, dependencies: Readonly<{ telemetry?: HpmAttentionTelemetry }>): HpmAttentionProjectionResult { dependencies.telemetry?.emit({ name: "hpm_attention_projection_failed", correlationId: request.correlationId, scopeType: request.lifecycleProjection.scope.type, classification: code }); return Object.freeze({ ok: false, code, message }); }
