import type {
  AutomationHealthStatus,
  AutomationIntegrationHealth,
} from "./automation-operations-contracts";

export type AutomationIntegrationRegistration = Readonly<{
  id: string;
  owner: string;
  direction: "inbound" | "outbound" | "bidirectional-read";
  supportedVersions: readonly string[];
  required: boolean;
  featureFlag: string;
  timeoutMs: number;
  circuitBreaker: Readonly<{ failures: number; resetAfterMs: number }>;
  degradation: string;
  runbook: string;
}>;

const command = (
  id: string,
  owner: string,
  required = false,
): AutomationIntegrationRegistration =>
  Object.freeze({
    id,
    owner,
    direction: "outbound",
    supportedVersions: Object.freeze(["v1"]),
    required,
    featureFlag: `AUTOMATION_DISPATCH_${id.toUpperCase().replaceAll("-", "_")}_ENABLED`,
    timeoutMs: 15_000,
    circuitBreaker: Object.freeze({ failures: 5, resetAfterMs: 60_000 }),
    degradation: `Queue ${owner} work without dispatch; preserve command identity for recovery.`,
    runbook: "docs/runbooks/automation-operations.md#4-command-adapter-outage",
  });

export const AUTOMATION_INTEGRATION_REGISTRY: readonly AutomationIntegrationRegistration[] =
  Object.freeze([
    Object.freeze({
      id: "hpm-lifecycle",
      owner: "HPM",
      direction: "outbound",
      supportedVersions: Object.freeze(["hpm-source-v1"]),
      required: false,
      featureFlag: "AUTOMATION_HPM_PUBLICATION_ENABLED",
      timeoutMs: 10_000,
      circuitBreaker: Object.freeze({ failures: 5, resetAfterMs: 60_000 }),
      degradation: "Preserve AU facts and publish on a later refresh.",
      runbook:
        "docs/runbooks/automation-operations.md#8-hpm-or-projection-staleness",
    }),
    command("execute", "Execute", true),
    command("decide", "Decide"),
    command("outcome-measurement", "EX-002"),
    command("learning", "LR-001"),
    command("recommendations", "LR-002"),
    command("furnishing", "Furnishing"),
    Object.freeze({
      id: "notifications",
      owner: "Platform Notifications",
      direction: "outbound",
      supportedVersions: Object.freeze(["outbox-v1"]),
      required: false,
      featureFlag: "AUTOMATION_NOTIFICATION_PROCESSING_ENABLED",
      timeoutMs: 10_000,
      circuitBreaker: Object.freeze({ failures: 10, resetAfterMs: 120_000 }),
      degradation:
        "Preserve deduplicated notification intents for later delivery.",
      runbook:
        "docs/runbooks/automation-operations.md#7-notification-outage-or-alert-storm",
    }),
    Object.freeze({
      id: "identity-authorization",
      owner: "Platform Identity",
      direction: "bidirectional-read",
      supportedVersions: Object.freeze(["workspace-access-v1"]),
      required: true,
      featureFlag: "AUTOMATION_AUTHORIZATION_ENABLED",
      timeoutMs: 5_000,
      circuitBreaker: Object.freeze({ failures: 1, resetAfterMs: 30_000 }),
      degradation: "Fail closed for all mutations and restricted reads.",
      runbook:
        "docs/runbooks/automation-operations.md#10-tenant-isolation-or-authorization-concern",
    }),
  ]);

export function validateAutomationIntegrations(
  input: Readonly<
    Record<
      string,
      Readonly<{ configured: boolean; enabled: boolean; version?: string }>
    >
  >,
): readonly AutomationIntegrationHealth[] {
  return Object.freeze(
    AUTOMATION_INTEGRATION_REGISTRY.map((registration) => {
      const observed = input[registration.id],
        compatible = observed?.version
          ? registration.supportedVersions.includes(observed.version)
          : false;
      const compatibility: AutomationIntegrationHealth["compatibility"] =
        !observed?.enabled
          ? "disabled"
          : !observed.configured || !observed.version
            ? "unknown"
            : compatible
              ? "compatible"
              : "incompatible";
      const status: AutomationHealthStatus = !observed?.enabled
        ? "disabled"
        : compatibility === "compatible"
          ? "healthy"
          : registration.required
            ? "unhealthy"
            : "degraded";
      return Object.freeze({
        id: registration.id,
        owningCapability: registration.owner,
        direction: registration.direction,
        required: registration.required,
        configured: observed?.configured ?? false,
        enabled: observed?.enabled ?? false,
        expectedVersions: registration.supportedVersions,
        ...(observed?.version ? { observedVersion: observed.version } : {}),
        compatibility,
        status,
        degradation: registration.degradation,
        runbook: registration.runbook,
      });
    }),
  );
}

export function incompatibleRequiredIntegrations(
  integrations: readonly AutomationIntegrationHealth[],
) {
  return integrations.filter(
    (item) =>
      item.required && item.enabled && item.compatibility !== "compatible",
  );
}
