import { createHash } from "node:crypto";
import type {
  AutomationCohortRule,
  AutomationCommandRisk,
  AutomationReleaseActor,
  AutomationReleaseApproval,
  AutomationReleaseCohort,
  AutomationReleaseFlag,
  AutomationReleaseGate,
  AutomationReleaseRecord,
  AutomationReleaseResult,
  AutomationReleaseState,
} from "./automation-release-contracts";

const flag = (
  key: string,
  dependencies: readonly string[] = [],
  tier: 0 | 1 | 2 | 3 = 0,
): AutomationReleaseFlag =>
  Object.freeze({
    key,
    environment: "production",
    defaultEnabled: false,
    dependencies: Object.freeze(dependencies),
    killSwitch: `${key}_KILL_SWITCH`,
    riskTier: tier,
    owner: "automation-release-owner",
  });
export const AUTOMATION_RELEASE_FLAGS: readonly AutomationReleaseFlag[] =
  Object.freeze([
    flag("AUTOMATION_WORKSPACE_ENABLED"),
    flag("AUTOMATION_AUTHORING_ENABLED", ["AUTOMATION_WORKSPACE_ENABLED"]),
    flag("AUTOMATION_TRIGGER_INTAKE_ENABLED"),
    flag("AUTOMATION_SCHEDULER_EVALUATION_ENABLED", [
      "AUTOMATION_TRIGGER_INTAKE_ENABLED",
    ]),
    flag("AUTOMATION_MANUAL_TRIGGER_ENABLED", ["AUTOMATION_WORKSPACE_ENABLED"]),
    flag("AUTOMATION_APPROVAL_INTERACTION_ENABLED", [
      "AUTOMATION_WORKSPACE_ENABLED",
    ]),
    flag(
      "AUTOMATION_GOVERNED_DISPATCH_ENABLED",
      ["AUTOMATION_APPROVAL_INTERACTION_ENABLED"],
      1,
    ),
    flag(
      "AUTOMATION_RETRY_PROCESSING_ENABLED",
      ["AUTOMATION_GOVERNED_DISPATCH_ENABLED"],
      1,
    ),
    flag("AUTOMATION_RECONCILIATION_WORKER_ENABLED", [
      "AUTOMATION_WORKSPACE_ENABLED",
    ]),
    flag("AUTOMATION_NOTIFICATION_PROCESSING_ENABLED", [
      "AUTOMATION_WORKSPACE_ENABLED",
    ]),
    flag("AUTOMATION_REPORTING_ENABLED", ["AUTOMATION_WORKSPACE_ENABLED"]),
    flag("AUTOMATION_EXPORTS_ENABLED", ["AUTOMATION_REPORTING_ENABLED"]),
    flag("AUTOMATION_TEMPLATE_CATALOG_ENABLED", [
      "AUTOMATION_WORKSPACE_ENABLED",
    ]),
  ]);
const cohort = (
  cohortName: AutomationReleaseCohort,
  tenants: number,
  properties: number,
  definitions: number,
  tiers: readonly (0 | 1 | 2 | 3)[],
  minutes: number,
  predecessor?: AutomationReleaseCohort,
): AutomationCohortRule =>
  Object.freeze({
    cohort: cohortName,
    maximumTenants: tenants,
    maximumProperties: properties,
    maximumDefinitions: definitions,
    allowedRiskTiers: Object.freeze(tiers),
    observationMinutes: minutes,
    ...(predecessor ? { predecessor } : {}),
    requiresApproval: true,
  });
export const AUTOMATION_COHORT_RULES: readonly AutomationCohortRule[] =
  Object.freeze([
    cohort("none", 0, 0, 0, [], 0),
    cohort("internal-read-only", 2, 25, 50, [0], 60, "none"),
    cohort("internal-shadow", 2, 25, 50, [0], 240, "internal-read-only"),
    cohort("internal-tier-one", 2, 25, 10, [0, 1], 1_440, "internal-shadow"),
    cohort("named-pilot", 5, 100, 25, [0, 1], 10_080, "internal-tier-one"),
    cohort("limited", 25, 500, 100, [0, 1], 10_080, "named-pilot"),
    cohort(
      "general-availability",
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      [0, 1],
      10_080,
      "limited",
    ),
  ]);

export function evaluateAutomationReleaseFlags(
  input: Readonly<{
    requested: Readonly<Record<string, boolean | undefined>>;
    killSwitches: Readonly<Record<string, boolean | undefined>>;
    environment: AutomationReleaseFlag["environment"];
    allowedRiskTiers: readonly (0 | 1 | 2 | 3)[];
  }>,
): Readonly<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  for (const definition of AUTOMATION_RELEASE_FLAGS)
    result[definition.key] =
      input.environment === definition.environment &&
      input.requested[definition.key] === true &&
      input.killSwitches[definition.killSwitch] !== true &&
      input.allowedRiskTiers.includes(definition.riskTier) &&
      definition.dependencies.every((key) => result[key] === true);
  return Object.freeze(result);
}
export function validateAutomationReleaseGates(
  gates: readonly AutomationReleaseGate[],
): AutomationReleaseResult<readonly AutomationReleaseGate[]> {
  const prerequisite = gates.find((gate) => gate.status === "blocked");
  if (prerequisite)
    return {
      ok: false,
      code: "AU_RELEASE_PREREQUISITE_FAILED",
      message: `Release gate ${prerequisite.id} is blocked.`,
    };
  const invalid = gates.find(
    (gate) =>
      gate.status === "approved_deferral" &&
      (!gate.deferral?.rationale.trim() ||
        !gate.deferral.mitigation.trim() ||
        !gate.deferral.followUp.trim()),
  );
  return invalid
    ? {
        ok: false,
        code: "AU_RELEASE_PREREQUISITE_FAILED",
        message: `Release deferral ${invalid.id} is incomplete.`,
      }
    : { ok: true, value: Object.freeze([...gates]) };
}
export function validateAutomationCommandRisks(
  commands: readonly AutomationCommandRisk[],
): AutomationReleaseResult<readonly AutomationCommandRisk[]> {
  const unsafe = commands.find(
    (item) => item.enabledForInitialRelease && item.tier > 1,
  );
  if (unsafe)
    return {
      ok: false,
      code: "AU_RELEASE_AUTONOMOUS_AUTHORITY_DETECTED",
      message: `Command ${unsafe.capability}:${unsafe.command} exceeds the initial release risk boundary.`,
    };
  const missingApproval = commands.find(
    (item) => item.tier >= 2 && !item.requiresApproval,
  );
  return missingApproval
    ? {
        ok: false,
        code: "AU_RELEASE_AUTONOMOUS_AUTHORITY_DETECTED",
        message: "Protected commands require explicit approval.",
      }
    : { ok: true, value: Object.freeze([...commands]) };
}
export function validateAutomationCohort(
  input: Readonly<{
    cohort: AutomationReleaseCohort;
    tenantCount: number;
    propertyCount: number;
    definitionCount: number;
    riskTiers: readonly (0 | 1 | 2 | 3)[];
    predecessorCompleted: boolean;
    approval?: AutomationReleaseApproval;
  }>,
): AutomationReleaseResult<AutomationCohortRule> {
  const rule = AUTOMATION_COHORT_RULES.find(
    ({ cohort: name }) => name === input.cohort,
  )!;
  if (
    !input.approval ||
    !input.predecessorCompleted ||
    input.tenantCount > rule.maximumTenants ||
    input.propertyCount > rule.maximumProperties ||
    input.definitionCount > rule.maximumDefinitions ||
    input.riskTiers.some((tier) => !rule.allowedRiskTiers.includes(tier))
  )
    return {
      ok: false,
      code: "AU_RELEASE_APPROVAL_REQUIRED",
      message: "The requested cohort is not eligible for enablement.",
    };
  return { ok: true, value: rule };
}

const transitions: Readonly<
  Record<AutomationReleaseState, readonly AutomationReleaseState[]>
> = Object.freeze({
  draft: ["candidate"],
  candidate: ["ready-for-rehearsal", "superseded"],
  "ready-for-rehearsal": ["rehearsal-passed", "halted"],
  "rehearsal-passed": ["ready-for-disabled-deployment", "halted"],
  "ready-for-disabled-deployment": ["deployed-disabled", "halted"],
  "deployed-disabled": [
    "internal-read-only",
    "paused",
    "halted",
    "rolled-back",
  ],
  "internal-read-only": ["internal-shadow", "paused", "halted", "rolled-back"],
  "internal-shadow": ["internal-tier-one", "paused", "halted", "rolled-back"],
  "internal-tier-one": ["pilot", "paused", "halted", "rolled-back"],
  pilot: ["stabilizing", "paused", "halted", "rolled-back"],
  stabilizing: ["released", "paused", "halted", "rolled-back"],
  released: ["superseded"],
  paused: [
    "deployed-disabled",
    "internal-read-only",
    "internal-shadow",
    "internal-tier-one",
    "pilot",
    "stabilizing",
    "halted",
    "rolled-back",
  ],
  halted: ["paused", "rolled-back"],
  "rolled-back": ["superseded"],
  superseded: [],
});
const productionStates: readonly AutomationReleaseState[] = [
  "ready-for-disabled-deployment",
  "deployed-disabled",
  "internal-read-only",
  "internal-shadow",
  "internal-tier-one",
  "pilot",
  "stabilizing",
  "released",
  "rolled-back",
];
export function transitionAutomationRelease(
  input: Readonly<{
    record: AutomationReleaseRecord;
    expectedVersion: number;
    to: AutomationReleaseState;
    actor: AutomationReleaseActor;
    approvals: readonly AutomationReleaseApproval[];
    environment: "development" | "test" | "preview" | "staging" | "production";
    correlationId: string;
    idempotencyKey: string;
    now: string;
    hpmFinalApproval: boolean;
    readinessGatesPassed: boolean;
    haltSignals?: readonly string[];
  }>,
): AutomationReleaseResult<AutomationReleaseRecord> {
  if (
    input.record.events.some(
      (event) => event.idempotencyKey === input.idempotencyKey,
    )
  )
    return { ok: true, value: input.record };
  if (
    !input.actor.active ||
    !input.actor.roleIds.some((role) =>
      [
        "release-owner",
        "administrator",
        "admin",
        "incident-commander",
      ].includes(role),
    )
  )
    return {
      ok: false,
      code: "AU_RELEASE_APPROVAL_REQUIRED",
      message: "Release authority is required.",
    };
  if (input.record.version !== input.expectedVersion)
    return {
      ok: false,
      code: "AU_RELEASE_PREREQUISITE_FAILED",
      message: "The release changed concurrently.",
      currentVersion: input.record.version,
    };
  if (!transitions[input.record.state].includes(input.to))
    return {
      ok: false,
      code: "AU_RELEASE_PREREQUISITE_FAILED",
      message: "The release transition is invalid.",
    };
  if (input.haltSignals?.length && input.to !== "halted")
    return {
      ok: false,
      code: "AU_RELEASE_THRESHOLD_BREACHED",
      message: "A categorical halt signal prevents promotion.",
    };
  if (productionStates.includes(input.to) && !input.hpmFinalApproval)
    return {
      ok: false,
      code: "AU_RELEASE_PREREQUISITE_FAILED",
      message:
        "HPM-001F final approval is required before AU production rollout.",
    };
  if (productionStates.includes(input.to) && !input.readinessGatesPassed)
    return {
      ok: false,
      code: "AU_RELEASE_PREREQUISITE_FAILED",
      message:
        "All AU readiness gates must pass before production promotion.",
    };
  const requiredAuthorities =
    input.to === "released"
      ? ["product", "engineering", "security", "operations", "release"]
      : productionStates.includes(input.to)
        ? ["release"]
        : [];
  if (
    requiredAuthorities.some(
      (authority) =>
        !input.approvals.some(
          (approval) =>
            approval.authority === authority && approval.rationale.trim(),
        ),
    )
  )
    return {
      ok: false,
      code: "AU_RELEASE_APPROVAL_REQUIRED",
      message: "Required release approvals are incomplete.",
    };
  const version = input.record.version + 1,
    event = Object.freeze({
      id: `au-release-event:${createHash("sha256").update(`${input.record.id}:${input.idempotencyKey}`).digest("hex").slice(0, 24)}`,
      from: input.record.state,
      to: input.to,
      environment: input.environment,
      actorId: input.actor.actorId,
      approvalAuthorities: Object.freeze(
        input.approvals.map(({ authority }) => authority),
      ),
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      occurredAt: input.now,
      classification: "AU_RELEASE_TRANSITION_ACCEPTED",
      version,
    });
  return {
    ok: true,
    value: Object.freeze({
      ...input.record,
      state: input.to,
      version,
      events: Object.freeze([...input.record.events, event]),
    }),
  };
}
