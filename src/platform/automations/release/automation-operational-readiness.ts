import type { AutomationOperationsPolicy } from "../operations";

export type AutomationOperationalOwner = Readonly<{
  name: string;
  role: "release" | "operations" | "security" | "database";
  escalationTarget: string;
}>;

export type AutomationOperationalReadinessInput = Readonly<{
  dashboards: Readonly<{
    health: string;
    queues: string;
    incidents: string;
    delivery: string;
  }>;
  policy: AutomationOperationsPolicy;
  owners: readonly AutomationOperationalOwner[];
  alertDelivery: Readonly<{
    channel: string;
    destination: string;
    verificationId?: string;
    verifiedAt?: string;
  }>;
}>;

export type AutomationOperationalReadiness = Readonly<{
  ready: boolean;
  blockers: readonly string[];
}>;

export function evaluateAutomationOperationalReadiness(
  input: AutomationOperationalReadinessInput,
): AutomationOperationalReadiness {
  const blockers: string[] = [];
  for (const [name, location] of Object.entries(input.dashboards))
    if (!https(location)) blockers.push(`dashboard_${name}_unconfigured`);
  for (const role of ["release", "operations", "security", "database"] as const) {
    const owner = input.owners.find((value) => value.role === role);
    if (!owner?.name.trim() || !owner.escalationTarget.trim())
      blockers.push(`owner_${role}_unconfigured`);
  }
  if (
    !input.alertDelivery.channel.trim() ||
    !input.alertDelivery.destination.trim()
  )
    blockers.push("alert_delivery_unconfigured");
  if (!input.alertDelivery.verificationId || !input.alertDelivery.verifiedAt)
    blockers.push("alert_delivery_unverified");
  if (!validPolicy(input.policy)) blockers.push("alert_thresholds_invalid");
  return Object.freeze({
    ready: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}

function https(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function validPolicy(policy: AutomationOperationsPolicy) {
  return (
    policy.staleAfterMs > 0 &&
    policy.queueWarningMs > 0 &&
    policy.queueCriticalMs > policy.queueWarningMs &&
    policy.approvalWarningMs > 0 &&
    policy.approvalCriticalMs > policy.approvalWarningMs &&
    policy.dispatchWarningMs > 0 &&
    policy.runWarningMs > 0 &&
    policy.reconciliationWarningMs > 0 &&
    policy.failureRateWarning > 0 &&
    policy.failureRateCritical > policy.failureRateWarning &&
    policy.failureRateCritical <= 1
  );
}
