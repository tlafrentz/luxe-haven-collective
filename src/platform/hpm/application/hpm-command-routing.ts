import type { HpmProjectionScope, HpmSourceReference, HpmValidNextCommand } from "./hpm-contracts";
import type { HpmActorContext } from "./hpm-source-ports";
import type { HpmSourceCapability } from "./hpm-vocabulary";

export const HPM_COMMAND_VOCABULARY_VERSION = "hpm-command-v1";
export const HPM_ROUTING_POLICY_VERSION = "hpm-routing-v1";

export type HpmCommandFailureCode =
  | "HPM_SCOPE_NOT_FOUND" | "HPM_SCOPE_ACCESS_DENIED" | "HPM_SOURCE_UNAVAILABLE" | "HPM_SOURCE_STALE" | "HPM_SOURCE_CONTRACT_UNSUPPORTED"
  | "HPM_COMMAND_NOT_SUPPORTED" | "HPM_COMMAND_NOT_VALID" | "HPM_COMMAND_ACCESS_DENIED" | "HPM_COMMAND_INPUT_INVALID"
  | "HPM_COMMAND_CONFIRMATION_REQUIRED" | "HPM_COMMAND_REASON_REQUIRED" | "HPM_COMMAND_VERSION_CONFLICT" | "HPM_COMMAND_IDEMPOTENCY_CONFLICT"
  | "HPM_COMMAND_ROUTE_UNAVAILABLE" | "HPM_COMMAND_HANDOFF_REJECTED" | "HPM_COMMAND_HANDOFF_FAILED" | "HPM_COMMAND_RESULT_UNAVAILABLE" | "CONCURRENT_MODIFICATION";

export type HpmCommandRoutingRequest = Readonly<{
  actor: HpmActorContext;
  commandType: string;
  commandVocabularyVersion: string;
  owningCapability: HpmSourceCapability;
  target: HpmSourceReference;
  expectedVersion: string;
  input: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
  correlationId: string;
  causationId: string;
  scopeType: "property" | "portfolio";
  scopeId: string;
}>;

export type HpmCanonicalCommandResult = Readonly<{ ok: true; recordId: string; recordVersion: string; classification: string; destination?: string } | { ok: false; classification: string; message?: string }>;
export type HpmCommandRoutingResult = Readonly<
  | { ok: true; status: "completed"; owningCapability: HpmSourceCapability; target: HpmSourceReference; resultingRecordId: string; resultingVersion: string; sourceClassification: string; projectionAction: "refreshed" | "refresh-required" | "none"; destination?: string; correlationId: string; idempotencyKey: string }
  | { ok: false; status: "rejected" | "failed" | "conflict"; code: HpmCommandFailureCode; message: string; owningCapability: HpmSourceCapability; target: HpmSourceReference; projectionAction: "refresh-required" | "none"; correlationId: string; idempotencyKey: string }
>;

export interface HpmCommandRoute {
  readonly capability: HpmSourceCapability;
  readonly commandType: string;
  readonly vocabularyVersion: string;
  authorize(request: HpmCommandRoutingRequest, scope: HpmProjectionScope): Promise<Readonly<{ allowed: true } | { allowed: false; classification: string }>>;
  dispatch(request: HpmCommandRoutingRequest, scope: HpmProjectionScope): Promise<HpmCanonicalCommandResult>;
}
export function createHpmCommandRoute(input: HpmCommandRoute): HpmCommandRoute {
  if (!input.commandType.trim()) throw new Error("HPM_COMMAND_TYPE_REQUIRED");
  if (!input.vocabularyVersion.trim()) throw new Error("HPM_COMMAND_VERSION_REQUIRED");
  return Object.freeze(input);
}
export interface HpmCommandScopeResolver { resolve(input: Readonly<{ actor: HpmActorContext; scopeType: "property" | "portfolio"; scopeId: string }>): Promise<Readonly<{ ok: true; scope: HpmProjectionScope } | { ok: false; code: "HPM_SCOPE_NOT_FOUND" | "HPM_SCOPE_ACCESS_DENIED" }>>; }
export interface HpmProjectionRefresher { refresh(input: Readonly<{ actor: HpmActorContext; scope: HpmProjectionScope; target: HpmSourceReference; correlationId: string; causationId: string }>): Promise<Readonly<{ ok: boolean }>>; }
export interface HpmRoutingTelemetry { emit(event: Readonly<{ name: string; correlationId: string; causationId?: string; scopeType: string; capability: HpmSourceCapability; recordType: string; commandType: string; classification?: string }>): void; }

export type HpmCommandRouteRegistry = ReadonlyMap<string, HpmCommandRoute>;
export function createHpmCommandRouteRegistry(routes: readonly HpmCommandRoute[]): HpmCommandRouteRegistry {
  const values = new Map<string, HpmCommandRoute>();
  for (const route of routes) { const key = routeKey(route.capability, route.commandType, route.vocabularyVersion); if (values.has(key)) throw new Error(`HPM_COMMAND_ROUTE_DUPLICATE:${key}`); values.set(key, Object.freeze(route)); }
  return values;
}

export function projectHpmValidCommands(input: Readonly<{ descriptors: readonly HpmValidNextCommand[]; actor: HpmActorContext; sourceFreshness: string; registeredRoutes: HpmCommandRouteRegistry }>): readonly HpmValidNextCommand[] {
  if (!input.actor.active || ["stale", "unavailable", "not-configured"].includes(input.sourceFreshness)) return Object.freeze([]);
  return Object.freeze(input.descriptors.filter((command) => command.availability === "available" && command.vocabularyVersion === HPM_COMMAND_VOCABULARY_VERSION && input.registeredRoutes.has(routeKey(command.owningCapability, command.type, command.vocabularyVersion))).map((command) => Object.freeze(command)));
}

export function createHpmCommandRoutingService(dependencies: Readonly<{ routes: HpmCommandRouteRegistry; scopeResolver: HpmCommandScopeResolver; refresher: HpmProjectionRefresher; telemetry?: HpmRoutingTelemetry }>) {
  return Object.freeze({
    async routeHpmCommand(request: HpmCommandRoutingRequest): Promise<HpmCommandRoutingResult> {
      emit(dependencies, "hpm_command_routing_started", request);
      if (!request.actor.active) return commandFailure(request, "HPM_COMMAND_ACCESS_DENIED", "The command is not authorized.", "rejected", "none", dependencies);
      if (request.commandVocabularyVersion !== HPM_COMMAND_VOCABULARY_VERSION || request.target.capability !== request.owningCapability || request.expectedVersion !== request.target.recordVersion || !request.idempotencyKey.trim()) return commandFailure(request, "HPM_COMMAND_INPUT_INVALID", "The command request is invalid.", "rejected", "none", dependencies);
      let resolved: Awaited<ReturnType<HpmCommandScopeResolver["resolve"]>>;
      try { resolved = await dependencies.scopeResolver.resolve({ actor: request.actor, scopeType: request.scopeType, scopeId: request.scopeId }); } catch { return commandFailure(request, "HPM_COMMAND_ROUTE_UNAVAILABLE", "The command scope is unavailable.", "failed", "none", dependencies); }
      if (!resolved.ok) return commandFailure(request, resolved.code, "The command scope is unavailable.", "rejected", "none", dependencies);
      const route = dependencies.routes.get(routeKey(request.owningCapability, request.commandType, request.commandVocabularyVersion));
      if (!route) return commandFailure(request, "HPM_COMMAND_NOT_SUPPORTED", "No owning capability route supports this command.", "rejected", "none", dependencies);
      let authorization: Awaited<ReturnType<HpmCommandRoute["authorize"]>>;
      try { authorization = await route.authorize(request, resolved.scope); } catch { return commandFailure(request, "HPM_COMMAND_ROUTE_UNAVAILABLE", "The owning capability could not authorize the command.", "failed", "none", dependencies); }
      if (!authorization.allowed) { emit(dependencies, "hpm_command_authorization_denied", request, authorization.classification); return commandFailure(request, mapFailure(authorization.classification), "The command is not authorized or valid.", "rejected", "none", dependencies); }
      emit(dependencies, "hpm_command_handoff_started", request);
      let source: HpmCanonicalCommandResult;
      try { source = await route.dispatch(request, resolved.scope); } catch { return commandFailure(request, "HPM_COMMAND_HANDOFF_FAILED", "The owning capability command failed safely.", "failed", "refresh-required", dependencies); }
      if (!source.ok) { const code = mapFailure(source.classification), conflict = code === "HPM_COMMAND_VERSION_CONFLICT" || code === "CONCURRENT_MODIFICATION"; emit(dependencies, conflict ? "hpm_command_version_conflict" : "hpm_command_handoff_rejected", request, code); if (conflict) await safeRefresh(dependencies, request, resolved.scope); return commandFailure(request, code, "The owning capability rejected the command.", conflict ? "conflict" : "rejected", conflict ? "refresh-required" : "none", dependencies); }
      emit(dependencies, "hpm_command_handoff_completed", request, source.classification);
      const refreshed = await safeRefresh(dependencies, request, resolved.scope);
      return Object.freeze({ ok: true, status: "completed", owningCapability: request.owningCapability, target: request.target, resultingRecordId: source.recordId, resultingVersion: source.recordVersion, sourceClassification: source.classification, projectionAction: refreshed ? "refreshed" : "refresh-required", destination: source.destination, correlationId: request.correlationId, idempotencyKey: request.idempotencyKey });
    },
  });
}

async function safeRefresh(dependencies: Readonly<{ refresher: HpmProjectionRefresher; telemetry?: HpmRoutingTelemetry }>, request: HpmCommandRoutingRequest, scope: HpmProjectionScope) { emit(dependencies, "hpm_post_command_refresh_requested", request); try { const result = await dependencies.refresher.refresh({ actor: request.actor, scope, target: request.target, correlationId: request.correlationId, causationId: request.causationId }); emit(dependencies, result.ok ? "hpm_post_command_refresh_completed" : "hpm_post_command_refresh_failed", request); return result.ok; } catch { emit(dependencies, "hpm_post_command_refresh_failed", request); return false; } }
function routeKey(capability: HpmSourceCapability, commandType: string, version: string) { return `${capability}:${commandType}:${version}`; }
function mapFailure(value: string): HpmCommandFailureCode { const values: HpmCommandFailureCode[] = ["HPM_SCOPE_NOT_FOUND","HPM_SCOPE_ACCESS_DENIED","HPM_SOURCE_UNAVAILABLE","HPM_SOURCE_STALE","HPM_SOURCE_CONTRACT_UNSUPPORTED","HPM_COMMAND_NOT_SUPPORTED","HPM_COMMAND_NOT_VALID","HPM_COMMAND_ACCESS_DENIED","HPM_COMMAND_INPUT_INVALID","HPM_COMMAND_CONFIRMATION_REQUIRED","HPM_COMMAND_REASON_REQUIRED","HPM_COMMAND_VERSION_CONFLICT","HPM_COMMAND_IDEMPOTENCY_CONFLICT","HPM_COMMAND_ROUTE_UNAVAILABLE","HPM_COMMAND_HANDOFF_REJECTED","HPM_COMMAND_HANDOFF_FAILED","HPM_COMMAND_RESULT_UNAVAILABLE","CONCURRENT_MODIFICATION"]; return values.includes(value as HpmCommandFailureCode) ? value as HpmCommandFailureCode : "HPM_COMMAND_HANDOFF_REJECTED"; }
function commandFailure(request: HpmCommandRoutingRequest, code: HpmCommandFailureCode, message: string, status: "rejected" | "failed" | "conflict", projectionAction: "refresh-required" | "none", dependencies: Readonly<{ telemetry?: HpmRoutingTelemetry }>): HpmCommandRoutingResult { emit(dependencies, "hpm_command_routing_failed", request, code); return Object.freeze({ ok: false, status, code, message, owningCapability: request.owningCapability, target: request.target, projectionAction, correlationId: request.correlationId, idempotencyKey: request.idempotencyKey }); }
function emit(dependencies: Readonly<{ telemetry?: HpmRoutingTelemetry }>, name: string, request: HpmCommandRoutingRequest, classification?: string) { dependencies.telemetry?.emit({ name, correlationId: request.correlationId, causationId: request.causationId, scopeType: request.scopeType, capability: request.owningCapability, recordType: request.target.recordType, commandType: request.commandType, classification }); }
