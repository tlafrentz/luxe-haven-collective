import { AutomationFoundationError, canManageAutomation, createAutomationDefinitionVersion, transitionAutomationDefinition, type AutomationActor, type AutomationDefinition, type AutomationDefinitionConfiguration, type AutomationDefinitionStatus, type AutomationDefinitionVersion } from "../domain/automation-definition";

export type AutomationActivityEvent = Readonly<{ id: string; tenantId: string; automationId: string; definitionVersion: number; eventType: string; actorId: string; occurredAt: string; correlationId: string; causationId?: string; safeMetadata: Readonly<Record<string, unknown>> }>;
export type AutomationNotificationIntent = Readonly<{ id: string; tenantId: string; automationId: string; recipientId: string; eventType: string; idempotencyKey: string; safeTemplateVariables: Readonly<Record<string, string>>; createdAt: string }>;

export interface AutomationDefinitionRepository {
  get(tenantId: string, automationId: string): Promise<Readonly<{ definition: AutomationDefinition; current: AutomationDefinitionVersion }> | null>;
  list(tenantId: string): Promise<readonly Readonly<{ definition: AutomationDefinition; current: AutomationDefinitionVersion }>[]>;
  create(input: Readonly<{ definition: AutomationDefinition; version: AutomationDefinitionVersion; activity: AutomationActivityEvent }>): Promise<void>;
  appendVersion(input: Readonly<{ expectedVersion: number; definition: AutomationDefinition; version: AutomationDefinitionVersion; activity: AutomationActivityEvent; notification?: AutomationNotificationIntent }>): Promise<void>;
}
export interface AutomationAuthorizationPort { authorize(input: Readonly<{ actor: AutomationActor; operation: "create" | "edit" | "submit" | "return" | "activate" | "pause" | "resume" | "retire" | "archive"; tenantId: string; propertyIds: readonly string[] }>): Promise<boolean>; }
export interface AutomationFoundationTelemetry { emit(event: Readonly<{ name: string; tenantId: string; automationId: string; correlationId: string; classification: string }>): void; }
export type AutomationFoundationResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: string; message: string; currentVersion?: number }>;

export function createAutomationFoundationService(dependencies: Readonly<{ repository: AutomationDefinitionRepository; authorization: AutomationAuthorizationPort; clock: () => string; id: () => string; telemetry?: AutomationFoundationTelemetry }>) {
  async function authorize(actor: AutomationActor, operation: Parameters<AutomationAuthorizationPort["authorize"]>[0]["operation"], tenantId: string, propertyIds: readonly string[]) {
    if (!canManageAutomation(actor, tenantId, propertyIds) || !await dependencies.authorization.authorize({ actor, operation, tenantId, propertyIds })) throw new AutomationFoundationError("AUTOMATION_ACCESS_DENIED", "Automation access is denied.");
  }
  return Object.freeze({
    async createDraft(input: Readonly<{ actor: AutomationActor; tenantId: string; automationId?: string; name: string; description: string; templateOrigin?: string; configuration: AutomationDefinitionConfiguration; correlationId: string }>): Promise<AutomationFoundationResult<Readonly<{ definition: AutomationDefinition; current: AutomationDefinitionVersion }>>> {
      try {
        await authorize(input.actor, "create", input.tenantId, input.configuration.scope.propertyIds);
        const now = dependencies.clock(), automationId = input.automationId ?? dependencies.id();
        const existing = await dependencies.repository.get(input.tenantId, automationId);
        if (existing) return { ok: false, code: "AUTOMATION_DUPLICATE", message: "Automation already exists.", currentVersion: existing.definition.version };
        const definition: AutomationDefinition = Object.freeze({ id: automationId, tenantId: input.tenantId, status: "draft", currentVersion: 1, version: 1, createdBy: input.actor.actorId, createdAt: now });
        const current = createAutomationDefinitionVersion({ id: dependencies.id(), automationId, tenantId: input.tenantId, version: 1, name: input.name, description: input.description, status: "draft", ...(input.templateOrigin ? { templateOrigin: input.templateOrigin } : {}), configuration: input.configuration, compatibility: "unverified", createdBy: input.actor.actorId, createdAt: now, reason: "Initial draft" });
        await dependencies.repository.create({ definition, version: current, activity: activity(dependencies.id(), input, automationId, 1, "automation-draft-created", now) });
        dependencies.telemetry?.emit({ name: "automation_definition_created", tenantId: input.tenantId, automationId, correlationId: input.correlationId, classification: "draft" });
        return { ok: true, value: Object.freeze({ definition, current }) };
      } catch (error) { return failure(error); }
    },
    async get(input: Readonly<{ actor: AutomationActor; tenantId: string; automationId: string }>) {
      const value = await dependencies.repository.get(input.tenantId, input.automationId);
      if (!value) return { ok: false, code: "AUTOMATION_NOT_FOUND", message: "Automation was not found." } as const;
      try { await authorize(input.actor, "edit", input.tenantId, value.current.configuration.scope.propertyIds); return { ok: true, value } as const; } catch (error) { return failure(error); }
    },
    async list(input: Readonly<{ actor: AutomationActor; tenantId: string }>) {
      try {
        if (!input.actor.active || input.actor.tenantId !== input.tenantId) throw new AutomationFoundationError("AUTOMATION_ACCESS_DENIED", "Automation access is denied.");
        const values = await dependencies.repository.list(input.tenantId);
        const authorized = [];
        for (const value of values) if (canManageAutomation(input.actor, input.tenantId, value.current.configuration.scope.propertyIds) && await dependencies.authorization.authorize({ actor: input.actor, operation: "edit", tenantId: input.tenantId, propertyIds: value.current.configuration.scope.propertyIds })) authorized.push(value);
        return { ok: true, value: Object.freeze(authorized) } as const;
      } catch (error) { return failure(error); }
    },
    async revise(input: Readonly<{ actor: AutomationActor; tenantId: string; automationId: string; expectedVersion: number; name: string; description: string; configuration: AutomationDefinitionConfiguration; reason: string; correlationId: string }>) {
      try {
        const stored = await dependencies.repository.get(input.tenantId, input.automationId);
        if (!stored) throw new AutomationFoundationError("AUTOMATION_NOT_FOUND", "Automation was not found.");
        await authorize(input.actor, "edit", input.tenantId, stored.current.configuration.scope.propertyIds);
        if (stored.definition.version !== input.expectedVersion) return { ok: false, code: "AUTOMATION_VERSION_CONFLICT", message: "Automation changed after it was loaded.", currentVersion: stored.definition.version } as const;
        if (!["draft", "paused"].includes(stored.definition.status)) throw new AutomationFoundationError("AUTOMATION_TRANSITION_INVALID", "Only draft or paused automations may be revised.");
        const now = dependencies.clock(), nextVersion = stored.definition.currentVersion + 1;
        const definition = Object.freeze({ ...stored.definition, currentVersion: nextVersion, version: stored.definition.version + 1 });
        const version = createAutomationDefinitionVersion({ id: dependencies.id(), automationId: input.automationId, tenantId: input.tenantId, version: nextVersion, name: input.name, description: input.description, status: stored.definition.status, configuration: input.configuration, compatibility: "unverified", createdBy: input.actor.actorId, createdAt: now, reason: input.reason });
        await dependencies.repository.appendVersion({ expectedVersion: input.expectedVersion, definition, version, activity: activity(dependencies.id(), input, input.automationId, definition.version, "automation-version-created", now) });
        return { ok: true, value: Object.freeze({ definition, current: version }) } as const;
      } catch (error) { return failure(error); }
    },
    async transition(input: Readonly<{ actor: AutomationActor; tenantId: string; automationId: string; expectedVersion: number; to: AutomationDefinitionStatus; reviewerAuthorized?: boolean; activatorAuthorized?: boolean; reason?: string; correlationId: string }>) {
      try {
        const stored = await dependencies.repository.get(input.tenantId, input.automationId);
        if (!stored) throw new AutomationFoundationError("AUTOMATION_NOT_FOUND", "Automation was not found.");
        const operation = operationFor(input.to);
        await authorize(input.actor, operation, input.tenantId, stored.current.configuration.scope.propertyIds);
        if (stored.definition.version !== input.expectedVersion) return { ok: false, code: "AUTOMATION_VERSION_CONFLICT", message: "Automation changed after it was loaded.", currentVersion: stored.definition.version } as const;
        const status = transitionAutomationDefinition(stored.definition.status, input.to, input);
        const now = dependencies.clock(), aggregateVersion = stored.definition.version + 1;
        const definition = Object.freeze({ ...stored.definition, status, version: aggregateVersion, ...transitionMetadata(status, input.actor.actorId, now) });
        const version = createAutomationDefinitionVersion({ ...stored.current, id: dependencies.id(), version: stored.definition.currentVersion + 1, status, createdBy: input.actor.actorId, createdAt: now, reason: input.reason?.trim() || `Transition to ${status}` });
        const eventType = `automation-${status}`;
        await dependencies.repository.appendVersion({ expectedVersion: input.expectedVersion, definition, version, activity: activity(dependencies.id(), input, input.automationId, aggregateVersion, eventType, now), notification: Object.freeze({ id: dependencies.id(), tenantId: input.tenantId, automationId: input.automationId, recipientId: stored.current.configuration.ownerId, eventType, idempotencyKey: `automation:${input.automationId}:v${aggregateVersion}:${eventType}`, safeTemplateVariables: Object.freeze({ automationId: input.automationId, status }), createdAt: now }) });
        return { ok: true, value: Object.freeze({ definition, current: version }) } as const;
      } catch (error) { return failure(error); }
    },
  });
}

function activity(id: string, input: Readonly<{ actor: AutomationActor; tenantId: string; correlationId: string }>, automationId: string, version: number, eventType: string, occurredAt: string): AutomationActivityEvent { return Object.freeze({ id, tenantId: input.tenantId, automationId, definitionVersion: version, eventType, actorId: input.actor.actorId, occurredAt, correlationId: input.correlationId, safeMetadata: Object.freeze({}) }); }
function operationFor(to: AutomationDefinitionStatus): Parameters<AutomationAuthorizationPort["authorize"]>[0]["operation"] { return ({ "ready-for-review": "submit", draft: "return", active: "activate", paused: "pause", retired: "retire", archived: "archive" } as const)[to]; }
function transitionMetadata(status: AutomationDefinitionStatus, actorId: string, at: string) { if (status === "active") return { activatedBy: actorId, activatedAt: at }; if (status === "paused") return { pausedBy: actorId, pausedAt: at }; if (status === "retired") return { retiredBy: actorId, retiredAt: at }; if (status === "archived") return { archivedBy: actorId, archivedAt: at }; return {}; }
function failure(error: unknown): Readonly<{ ok: false; code: string; message: string }> { return error instanceof AutomationFoundationError ? { ok: false, code: error.code, message: error.message } : { ok: false, code: "AUTOMATION_DEFINITION_INVALID", message: "Automation operation failed safely." }; }
