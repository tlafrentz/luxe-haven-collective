import { createHash } from "node:crypto";
import type { HpmCohortRule, HpmFeatureKey, HpmReleaseActor, HpmReleaseApproval, HpmReleaseCohort, HpmReleaseFlag, HpmReleaseGate, HpmReleaseRecord, HpmReleaseResult, HpmReleaseState } from "./hpm-release-contracts";

export const HPM_RELEASE_FLAGS: readonly HpmReleaseFlag[] = Object.freeze([
  flag("workspace", []), flag("lifecycle", ["workspace"]), flag("attention", ["lifecycle"]),
  flag("command-routing", ["lifecycle"]), flag("reporting", ["lifecycle"]), flag("operations", ["workspace"]),
  flag("learn", ["lifecycle"]), flag("recommend", ["learn"]),
]);
function flag(key: HpmFeatureKey, dependencies: readonly HpmFeatureKey[]): HpmReleaseFlag { return Object.freeze({ key, owner: "hpm-release-owner", defaultEnabled: false, environments: ["preview", "staging", "production"] as const, dependencies, killSwitch: `HPM_${key.replaceAll("-", "_").toUpperCase()}_KILL_SWITCH`, removalCriteria: "Stable general availability and separate flag-removal review." }); }

export const HPM_COHORT_RULES: readonly HpmCohortRule[] = Object.freeze([
  cohort("verification", 2, 20, 30), cohort("internal", 5, 100, 60, "verification"),
  cohort("named-test-tenants", 10, 250, 240, "internal"), cohort("limited", 25, 1_000, 1_440, "named-test-tenants"),
  cohort("broad", 250, 10_000, 4_320, "limited"), cohort("general-availability", Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 10_080, "broad"),
]);
function cohort(cohortName: HpmReleaseCohort, maximumTenants: number, maximumProperties: number, observationMinutes: number, predecessor?: HpmReleaseCohort): HpmCohortRule { return Object.freeze({ cohort: cohortName, maximumTenants, maximumProperties, observationMinutes, requiresApproval: true, predecessor }); }

const transitions: Readonly<Record<HpmReleaseState, readonly HpmReleaseState[]>> = Object.freeze({
  draft: ["candidate"], candidate: ["ready-for-rehearsal", "superseded"], "ready-for-rehearsal": ["rehearsal-passed", "halted"],
  "rehearsal-passed": ["ready-for-production", "halted"], "ready-for-production": ["deployed-disabled", "halted"],
  "deployed-disabled": ["internal-enabled", "paused", "halted", "rolled-back"], "internal-enabled": ["limited-cohort", "paused", "halted", "rolled-back"],
  "limited-cohort": ["broad-cohort", "paused", "halted", "rolled-back"], "broad-cohort": ["stabilizing", "paused", "halted", "rolled-back"],
  stabilizing: ["released", "paused", "halted", "rolled-back"], released: ["superseded"], paused: ["deployed-disabled", "internal-enabled", "limited-cohort", "broad-cohort", "stabilizing", "halted", "rolled-back"],
  halted: ["rolled-back", "paused"], "rolled-back": ["superseded"], superseded: [],
});

export function evaluateHpmFeatureFlags(input: Readonly<{ requested: Partial<Record<HpmFeatureKey, boolean>>; killSwitches?: Partial<Record<HpmFeatureKey, boolean>> }>): Readonly<Record<HpmFeatureKey, boolean>> {
  const resolved = Object.fromEntries(HPM_RELEASE_FLAGS.map(({ key }) => [key, false])) as Record<HpmFeatureKey, boolean>;
  for (const definition of HPM_RELEASE_FLAGS) {
    const requested = input.requested[definition.key] === true;
    const killed = input.killSwitches?.[definition.key] === true;
    resolved[definition.key] = requested && !killed && definition.dependencies.every((dependency) => resolved[dependency]);
  }
  return Object.freeze(resolved);
}

export function evaluateHpmCohortAccess(input: Readonly<{ cohort: HpmReleaseCohort; enabled: boolean; profileRole?: string | null; tenantId?: string; namedTenantIds?: readonly string[] }>): boolean {
  if (!input.enabled) return false;
  if (input.cohort === "verification" || input.cohort === "internal") return input.profileRole === "admin";
  if (input.cohort === "named-test-tenants" || input.cohort === "limited") return Boolean(input.tenantId && input.namedTenantIds?.includes(input.tenantId));
  return input.cohort === "broad" || input.cohort === "general-availability";
}

export function validateReleaseGates(gates: readonly HpmReleaseGate[]): HpmReleaseResult<readonly HpmReleaseGate[]> {
  const blocker = gates.find((gate) => gate.required && !["passed", "approved-deferral", "not-applicable"].includes(gate.status));
  if (blocker) return { ok: false, code: "HPM_RELEASE_PREREQUISITE_FAILED", message: `Required release gate ${blocker.id} has not passed.` };
  const invalidDeferral = gates.find((gate) => gate.status === "approved-deferral" && (!gate.reason?.trim() || gate.evidenceReferences.length === 0));
  if (invalidDeferral) return { ok: false, code: "HPM_RELEASE_PREREQUISITE_FAILED", message: `Deferral ${invalidDeferral.id} is incomplete.` };
  return { ok: true, value: Object.freeze([...gates]) };
}

export function transitionHpmRelease(input: Readonly<{ record: HpmReleaseRecord; expectedVersion: number; to: HpmReleaseState; actor: HpmReleaseActor; approval?: HpmReleaseApproval; environment: "development" | "test" | "preview" | "staging" | "production"; correlationId: string; idempotencyKey: string; now: string }>): HpmReleaseResult<HpmReleaseRecord> {
  const existing = input.record.events.find((event) => event.idempotencyKey === input.idempotencyKey); if (existing) return { ok: true, value: input.record };
  if (!input.actor.active || !input.actor.roleIds.some((role) => ["owner", "administrator", "admin", "release-owner", "incident-commander"].includes(role))) return { ok: false, code: "HPM_RELEASE_APPROVAL_REQUIRED", message: "Release authority is required." };
  if (input.record.version !== input.expectedVersion) return { ok: false, code: "HPM_RELEASE_PREREQUISITE_FAILED", message: "The release changed. Refresh before retrying.", currentVersion: input.record.version };
  if (!transitions[input.record.state].includes(input.to)) return { ok: false, code: "HPM_RELEASE_HALTED", message: `Transition ${input.record.state} to ${input.to} is not allowed.` };
  if (["ready-for-production", "deployed-disabled", "internal-enabled", "limited-cohort", "broad-cohort", "stabilizing", "released", "rolled-back"].includes(input.to) && (!input.approval || !input.approval.rationale.trim())) return { ok: false, code: "HPM_RELEASE_APPROVAL_REQUIRED", message: "An explicit release approval is required." };
  const version = input.record.version + 1;
  const event = Object.freeze({ id: `hpm-release-event:${createHash("sha256").update(`${input.record.id}:${input.idempotencyKey}`).digest("hex").slice(0, 24)}`, releaseId: input.record.id, from: input.record.state, to: input.to, actorId: input.actor.actorId, environment: input.environment, correlationId: input.correlationId, idempotencyKey: input.idempotencyKey, occurredAt: input.now, result: "accepted" as const, classification: "HPM_RELEASE_TRANSITION_ACCEPTED", version });
  return { ok: true, value: Object.freeze({ ...input.record, state: input.to, version, events: Object.freeze([...input.record.events, event]) }) };
}

export function validateCohort(input: Readonly<{ cohort: HpmReleaseCohort; tenantCount: number; propertyCount: number; approval?: HpmReleaseApproval; predecessorCompleted: boolean }>): HpmReleaseResult<HpmCohortRule> {
  const rule = HPM_COHORT_RULES.find(({ cohort }) => cohort === input.cohort)!;
  if (!input.approval || !input.predecessorCompleted || input.tenantCount > rule.maximumTenants || input.propertyCount > rule.maximumProperties) return { ok: false, code: "HPM_RELEASE_COHORT_INELIGIBLE", message: "The cohort is not eligible for enablement." };
  return { ok: true, value: rule };
}
