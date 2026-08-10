export const AUTOMATION_DEFINITION_STATUSES = ["draft", "ready-for-review", "active", "paused", "retired", "archived"] as const;
export type AutomationDefinitionStatus = (typeof AUTOMATION_DEFINITION_STATUSES)[number];
export type AutomationScopeType = "property" | "selected-properties" | "portfolio" | "organization";
export type AutomationTriggerKind = "schedule" | "domain-event" | "state-change" | "manual";
export type AutomationApprovalMode = "none" | "before-run" | "before-step" | "on-policy-exception" | "dual";

export type AutomationActor = Readonly<{
  actorId: string;
  tenantId: string;
  role: "owner" | "administrator" | "operator" | "contributor" | "viewer" | "service";
  active: boolean;
  propertyIds: readonly string[];
}>;

export type AutomationDefinitionConfiguration = Readonly<{
  scope: Readonly<{ type: AutomationScopeType; propertyIds: readonly string[] }>;
  ownerId: string;
  operationalStewardId?: string;
  trigger: Readonly<{ kind: AutomationTriggerKind; schemaVersion: string; sourceCapability: string; specification: Readonly<Record<string, unknown>> }>;
  conditions: readonly Readonly<Record<string, unknown>>[];
  exclusions: readonly Readonly<Record<string, unknown>>[];
  command: Readonly<{ owningCapability: string; commandType: string; contractVersion: string }>;
  approval: Readonly<{ mode: AutomationApprovalMode; authority: string }>;
  execution: Readonly<{ maxFanOut: number; maxChainDepth: number; concurrency: "allow" | "drop" | "queue" | "replace-pending" }>;
  retry: Readonly<{ maxAttempts: number; timeoutMs: number }>;
  notification: Readonly<{ eventTypes: readonly string[] }>;
  effectiveFrom: string;
  validUntil?: string;
}>;

export type AutomationDefinitionVersion = Readonly<{
  id: string;
  automationId: string;
  tenantId: string;
  version: number;
  name: string;
  description: string;
  status: AutomationDefinitionStatus;
  templateOrigin?: string;
  configuration: AutomationDefinitionConfiguration;
  schemaVersion: "au001-definition.v1";
  policyVersion: "au001-foundation.v1";
  compatibility: "compatible" | "incompatible" | "unverified";
  createdBy: string;
  createdAt: string;
  reason: string;
}>;

export type AutomationDefinition = Readonly<{
  id: string;
  tenantId: string;
  status: AutomationDefinitionStatus;
  currentVersion: number;
  version: number;
  createdBy: string;
  createdAt: string;
  activatedBy?: string;
  activatedAt?: string;
  pausedBy?: string;
  pausedAt?: string;
  retiredBy?: string;
  retiredAt?: string;
  archivedBy?: string;
  archivedAt?: string;
}>;

const transitions: Readonly<Record<AutomationDefinitionStatus, readonly AutomationDefinitionStatus[]>> = Object.freeze({
  draft: ["ready-for-review", "archived"],
  "ready-for-review": ["draft", "active", "archived"],
  active: ["paused", "retired"],
  paused: ["active", "retired", "archived"],
  retired: ["archived"],
  archived: [],
});

export class AutomationFoundationError extends Error {
  public constructor(public readonly code: string, message: string) { super(message); this.name = "AutomationFoundationError"; Object.freeze(this); }
}

export function transitionAutomationDefinition(
  from: AutomationDefinitionStatus,
  to: AutomationDefinitionStatus,
  input: Readonly<{ actor: AutomationActor; reviewerAuthorized?: boolean; activatorAuthorized?: boolean; reason?: string }>,
): AutomationDefinitionStatus {
  if (!transitions[from].includes(to)) throw new AutomationFoundationError("AUTOMATION_TRANSITION_INVALID", `Invalid automation transition: ${from} to ${to}.`);
  requireActiveActor(input.actor);
  if (to === "active" && !input.activatorAuthorized) throw new AutomationFoundationError("AUTOMATION_ACCESS_DENIED", "Automation activation requires explicit authority.");
  if (from === "ready-for-review" && to === "draft" && !input.reviewerAuthorized) throw new AutomationFoundationError("AUTOMATION_ACCESS_DENIED", "Returning a definition requires review authority.");
  if (["draft", "paused", "retired", "archived"].includes(to) && from !== "draft" && !input.reason?.trim()) throw new AutomationFoundationError("AUTOMATION_DEFINITION_INVALID", "This transition requires a reason.");
  return to;
}

export function validateAutomationConfiguration(value: AutomationDefinitionConfiguration): readonly Readonly<{ severity: "blocking" | "warning" | "information"; code: string; message: string }>[] {
  const findings: Array<{ severity: "blocking" | "warning" | "information"; code: string; message: string }> = [];
  if (value.scope.type === "property" && value.scope.propertyIds.length !== 1) findings.push(blocking("AUTOMATION_TARGET_NOT_FOUND", "Property scope requires exactly one property."));
  if (value.scope.type === "selected-properties" && value.scope.propertyIds.length < 1) findings.push(blocking("AUTOMATION_TARGET_NOT_FOUND", "Selected-property scope requires at least one property."));
  if (!value.trigger.schemaVersion.trim() || !value.trigger.sourceCapability.trim()) findings.push(blocking("AUTOMATION_TRIGGER_INVALID", "Trigger source and schema version are required."));
  if (!value.command.owningCapability.trim() || !value.command.commandType.trim() || !value.command.contractVersion.trim()) findings.push(blocking("AUTOMATION_COMMAND_UNAVAILABLE", "An owning-capability command contract is required."));
  if (!Number.isSafeInteger(value.execution.maxFanOut) || value.execution.maxFanOut < 1 || value.execution.maxFanOut > 1000) findings.push(blocking("AUTOMATION_DEFINITION_INVALID", "Maximum fan-out must be between 1 and 1000."));
  if (!Number.isSafeInteger(value.execution.maxChainDepth) || value.execution.maxChainDepth < 0 || value.execution.maxChainDepth > 10) findings.push(blocking("AUTOMATION_CHAIN_LIMIT", "Maximum chain depth must be between 0 and 10."));
  if (!Number.isSafeInteger(value.retry.maxAttempts) || value.retry.maxAttempts < 1 || value.retry.maxAttempts > 10) findings.push(blocking("AUTOMATION_DEFINITION_INVALID", "Maximum attempts must be between 1 and 10."));
  if (!Number.isSafeInteger(value.retry.timeoutMs) || value.retry.timeoutMs < 1000 || value.retry.timeoutMs > 900_000) findings.push(blocking("AUTOMATION_DEFINITION_INVALID", "Timeout must be between one second and fifteen minutes."));
  if (!validDate(value.effectiveFrom) || value.validUntil && (!validDate(value.validUntil) || Date.parse(value.validUntil) <= Date.parse(value.effectiveFrom))) findings.push(blocking("AUTOMATION_DEFINITION_INVALID", "The effective window is invalid."));
  if (value.approval.mode === "none") findings.push({ severity: "warning", code: "AUTOMATION_APPROVAL_POLICY_REVIEW", message: "No-approval commands must be explicitly allowlisted before activation." });
  return Object.freeze(findings.map((finding) => Object.freeze(finding)));
}

export function createAutomationDefinitionVersion(input: Omit<AutomationDefinitionVersion, "schemaVersion" | "policyVersion">): AutomationDefinitionVersion {
  requireText(input.id, "Version ID"); requireText(input.automationId, "Automation ID"); requireText(input.tenantId, "Tenant ID");
  requireText(input.name, "Automation name"); requireText(input.description, "Automation description"); requireText(input.reason, "Version reason");
  if (!Number.isSafeInteger(input.version) || input.version < 1) throw new AutomationFoundationError("AUTOMATION_DEFINITION_INVALID", "Version must be a positive integer.");
  if (!validDate(input.createdAt)) throw new AutomationFoundationError("AUTOMATION_DEFINITION_INVALID", "Created timestamp is invalid.");
  const configuration = freezeConfiguration(input.configuration);
  const findings = validateAutomationConfiguration(configuration);
  if (findings.some(({ severity }) => severity === "blocking")) throw new AutomationFoundationError("AUTOMATION_DEFINITION_INVALID", findings.filter(({ severity }) => severity === "blocking").map(({ message }) => message).join(" "));
  return Object.freeze({ ...input, name: input.name.trim(), description: input.description.trim(), reason: input.reason.trim(), configuration, schemaVersion: "au001-definition.v1", policyVersion: "au001-foundation.v1" });
}

export function requireActiveActor(actor: AutomationActor): AutomationActor {
  if (!actor.active) throw new AutomationFoundationError("AUTOMATION_ACCESS_DENIED", "An active actor is required.");
  return actor;
}

export function canManageAutomation(actor: AutomationActor, tenantId: string, propertyIds: readonly string[]): boolean {
  if (!actor.active || actor.tenantId !== tenantId || !["owner", "administrator", "operator"].includes(actor.role)) return false;
  return actor.role === "owner" || actor.role === "administrator" || propertyIds.every((id) => actor.propertyIds.includes(id));
}

function freezeConfiguration(value: AutomationDefinitionConfiguration): AutomationDefinitionConfiguration {
  return Object.freeze({ ...value,
    scope: Object.freeze({ ...value.scope, propertyIds: Object.freeze([...new Set(value.scope.propertyIds)]) }),
    trigger: Object.freeze({ ...value.trigger, specification: Object.freeze({ ...value.trigger.specification }) }),
    conditions: Object.freeze(value.conditions.map((entry) => Object.freeze({ ...entry }))),
    exclusions: Object.freeze(value.exclusions.map((entry) => Object.freeze({ ...entry }))),
    command: Object.freeze({ ...value.command }), approval: Object.freeze({ ...value.approval }), execution: Object.freeze({ ...value.execution }), retry: Object.freeze({ ...value.retry }),
    notification: Object.freeze({ eventTypes: Object.freeze([...value.notification.eventTypes]) }),
  });
}
function blocking(code: string, message: string) { return { severity: "blocking" as const, code, message }; }
function validDate(value: string) { return Number.isFinite(Date.parse(value)); }
function requireText(value: string, field: string) { if (!value.trim()) throw new AutomationFoundationError("AUTOMATION_DEFINITION_INVALID", `${field} is required.`); }
