import type { HpmProjectedRecord, HpmProjectionScope, HpmSourceState } from "./hpm-contracts";
import { HPM_SOURCE_CAPABILITIES, type HpmSourceCapability } from "./hpm-vocabulary";

export type HpmActorContext = Readonly<{
  actorId: string;
  tenantId: string;
  roleIds: readonly string[];
  propertyIds: readonly string[];
  active: boolean;
}>;

export type HpmSourceQuery = Readonly<{
  scope: HpmProjectionScope;
  actor: HpmActorContext;
  correlationId: string;
  requestedAt: string;
}>;

export type HpmSourceProjection = Readonly<{
  state: HpmSourceState;
  records: readonly HpmProjectedRecord[];
}>;

/** Read-only by design. Canonical mutations remain behind owning application services. */
export interface HpmSourcePort {
  readonly capability: HpmSourceCapability;
  readonly contractVersion: string;
  project(query: HpmSourceQuery): Promise<HpmSourceProjection>;
}

export function createHpmProjectionSourcePort(input: Readonly<{
  capability: HpmSourceCapability;
  contractVersion: string;
  project: (query: HpmSourceQuery) => Promise<HpmSourceProjection>;
}>): HpmSourcePort {
  return Object.freeze({ capability: input.capability, contractVersion: input.contractVersion, project: input.project });
}

export function createUnavailableHpmSourcePort(capability: HpmSourceCapability, state: "unavailable" | "not-configured" = "not-configured"): HpmSourcePort {
  return Object.freeze({
    capability,
    contractVersion: "unavailable-v1",
    async project() {
      return Object.freeze({
        state: Object.freeze({ capability, contractVersion: "unavailable-v1", freshness: state, policyVersion: "unavailable-v1", failureClassification: state === "unavailable" ? "HPM_SOURCE_UNAVAILABLE" : undefined, reasonCode: `source-${state}`, contributesToCounts: false, contributesToHealth: true, contributesToLineage: false }),
        records: Object.freeze([]),
      });
    },
  });
}

export type HpmSourcePortRegistry = Readonly<Record<HpmSourceCapability, HpmSourcePort>>;

export type HpmSourceCompatibilityIssue = Readonly<{
  capability: HpmSourceCapability;
  code: "HPM_SOURCE_MISSING" | "HPM_SOURCE_CAPABILITY_MISMATCH" | "HPM_SOURCE_CONTRACT_UNSUPPORTED";
  message: string;
}>;

export function validateHpmSourcePorts(
  ports: Partial<Record<HpmSourceCapability, HpmSourcePort>>,
  supportedVersions: Readonly<Record<HpmSourceCapability, readonly string[]>>,
): readonly HpmSourceCompatibilityIssue[] {
  const issues: HpmSourceCompatibilityIssue[] = [];
  for (const capability of HPM_SOURCE_CAPABILITIES) {
    const port = ports[capability];
    if (!port) {
      issues.push({ capability, code: "HPM_SOURCE_MISSING", message: `${capability} source is unavailable.` });
      continue;
    }
    if (port.capability !== capability) {
      issues.push({ capability, code: "HPM_SOURCE_CAPABILITY_MISMATCH", message: `${capability} source identifies as ${port.capability}.` });
      continue;
    }
    if (!supportedVersions[capability].includes(port.contractVersion)) {
      issues.push({ capability, code: "HPM_SOURCE_CONTRACT_UNSUPPORTED", message: `${capability} contract ${port.contractVersion} is unsupported.` });
    }
  }
  return Object.freeze(issues.map((issue) => Object.freeze(issue)));
}

export function createHpmSourcePortRegistry(ports: readonly HpmSourcePort[]): HpmSourcePortRegistry {
  const byCapability = new Map<HpmSourceCapability, HpmSourcePort>();
  for (const port of ports) {
    if (byCapability.has(port.capability)) throw new Error(`HPM_SOURCE_DUPLICATE:${port.capability}`);
    byCapability.set(port.capability, port);
  }
  const missing = HPM_SOURCE_CAPABILITIES.filter((capability) => !byCapability.has(capability));
  if (missing.length) throw new Error(`HPM_SOURCE_MISSING:${missing.join(",")}`);
  return Object.freeze(Object.fromEntries(HPM_SOURCE_CAPABILITIES.map((capability) => [capability, byCapability.get(capability)!]))) as HpmSourcePortRegistry;
}
