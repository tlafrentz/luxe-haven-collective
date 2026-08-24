export const PS001D_SCENARIOS = Object.freeze([
  "admin",
  "authorized_operator",
  "authorized_owner",
  "wrong_tenant",
  "anonymous",
] as const);

export const PS001D_RESOURCE_TYPES = Object.freeze([
  "auth_identity",
  "workspace_membership",
  "property",
  "booking",
  "guest_communication",
  "report_request",
  "guidebook",
  "furnishing_project",
] as const);

export type Ps001dScenario = (typeof PS001D_SCENARIOS)[number];
export type Ps001dResourceType = (typeof PS001D_RESOURCE_TYPES)[number];
export type Ps001dBinding = Readonly<{
  candidateCommit: string;
  deploymentId: string;
  tenantId: string;
  correlationId: string;
}>;

export type Ps001dIdentityAuthorization = Ps001dBinding & Readonly<{
  scenario: Ps001dScenario;
  userId?: string;
  expectedRole: string;
  tenantRelationship: "platform_admin" | "active_member" | "wrong_tenant" | "unauthenticated";
  validFrom: Date;
  expiresAt: Date;
  revokedAt?: Date;
}>;

export type Ps001dPreflightInput = Readonly<{
  expected: Ps001dBinding;
  deployed: Ps001dBinding;
  aliasDeploymentId: string;
  migrationParity: boolean;
  requiredConfigurationPresent: boolean;
  fs008AndCatalogUnchanged: boolean;
  claimAvailable: boolean;
  ledgerAvailable: boolean;
  cleanupAvailable: boolean;
  activeClaimConflict: boolean;
  authorizations: readonly Ps001dIdentityAuthorization[];
  now: Date;
}>;

export type Ps001dPreflightResult = Readonly<{
  ready: boolean;
  blockerCodes: readonly string[];
}>;

export function evaluatePs001dPreflight(input: Ps001dPreflightInput): Ps001dPreflightResult {
  const blockers: string[] = [];
  for (const key of ["candidateCommit", "deploymentId", "tenantId", "correlationId"] as const) {
    if (input.expected[key] !== input.deployed[key]) blockers.push("PS001D_BINDING_MISMATCH");
  }
  if (input.aliasDeploymentId !== input.expected.deploymentId) blockers.push("PS001D_ALIAS_MISMATCH");
  if (!input.migrationParity) blockers.push("PS001D_MIGRATION_MISMATCH");
  if (!input.requiredConfigurationPresent) blockers.push("PS001D_CONFIGURATION_INCOMPLETE");
  if (!input.fs008AndCatalogUnchanged) blockers.push("PS001D_SCOPE_ISOLATION_FAILED");
  if (!input.claimAvailable || input.activeClaimConflict) blockers.push("PS001D_CLAIM_UNAVAILABLE");
  if (!input.ledgerAvailable) blockers.push("PS001D_LEDGER_UNAVAILABLE");
  if (!input.cleanupAvailable) blockers.push("PS001D_CLEANUP_UNAVAILABLE");
  for (const scenario of PS001D_SCENARIOS) {
    const matches = input.authorizations.filter((authorization) =>
      authorization.scenario === scenario &&
      sameBinding(authorization, input.expected) &&
      !authorization.revokedAt &&
      authorization.validFrom <= input.now &&
      authorization.expiresAt > input.now,
    );
    if (matches.length !== 1) blockers.push(`PS001D_${scenario.toUpperCase()}_AUTHORIZATION_INVALID`);
  }
  return Object.freeze({ ready: blockers.length === 0, blockerCodes: Object.freeze([...new Set(blockers)]) });
}

export function sameBinding(left: Ps001dBinding, right: Ps001dBinding) {
  return left.candidateCommit === right.candidateCommit &&
    left.deploymentId === right.deploymentId &&
    left.tenantId === right.tenantId &&
    left.correlationId === right.correlationId;
}

export type Ps001dLedgerResource = Readonly<{
  ledgerId: string;
  claimId: string;
  tenantId: string;
  type: Ps001dResourceType;
  canonicalId: string;
  dependencyOrder: number;
  status: "reserved" | "created" | "cleanup_pending" | "cleaned" | "retained" | "cleanup_failed";
}>;

export type Ps001dCleanupHandler = (resource: Ps001dLedgerResource) => Promise<"cleaned" | "retained">;
export type Ps001dCleanupHandlers = Readonly<Record<Ps001dResourceType, Ps001dCleanupHandler>>;

export async function executePs001dControlledCreation<T>(input: Readonly<{
  resource: Omit<Ps001dLedgerResource, "ledgerId" | "status">;
  reserve: (resource: Omit<Ps001dLedgerResource, "ledgerId" | "status">) => Promise<{ ledgerId: string }>;
  createThroughDomainBoundary: () => Promise<T>;
  markCreated: (ledgerId: string) => Promise<void>;
}>): Promise<T> {
  const reservation = await input.reserve(input.resource);
  const created = await input.createThroughDomainBoundary();
  await input.markCreated(reservation.ledgerId);
  return created;
}

export async function reconcilePs001dCleanup(input: Readonly<{
  claimId: string;
  tenantId: string;
  resources: readonly Ps001dLedgerResource[];
  handlers: Ps001dCleanupHandlers;
  record: (resource: Ps001dLedgerResource, result: "cleaned" | "retained" | "cleanup_failed", stableFailureCode?: string) => Promise<void>;
}>): Promise<Readonly<{ resolved: boolean; results: readonly Readonly<{ ledgerId: string; result: string }>[] }>> {
  const candidates = input.resources
    .filter((resource) => resource.claimId === input.claimId && resource.tenantId === input.tenantId)
    .filter((resource) => !["cleaned", "retained"].includes(resource.status))
    .sort((left, right) => right.dependencyOrder - left.dependencyOrder || left.ledgerId.localeCompare(right.ledgerId));
  if (candidates.length !== input.resources.filter((resource) => !["cleaned", "retained"].includes(resource.status)).length) {
    throw new Error("PS001D_CLEANUP_SCOPE_MISMATCH");
  }
  const results: { ledgerId: string; result: string }[] = [];
  for (const resource of candidates) {
    const handler = input.handlers[resource.type];
    if (!handler) throw new Error("PS001D_CLEANUP_TYPE_UNKNOWN");
    try {
      const result = await handler(resource);
      await input.record(resource, result);
      results.push({ ledgerId: resource.ledgerId, result });
    } catch {
      await input.record(resource, "cleanup_failed", "PS001D_CLEANUP_OPERATION_FAILED");
      results.push({ ledgerId: resource.ledgerId, result: "cleanup_failed" });
    }
  }
  return Object.freeze({
    resolved: results.every((result) => result.result !== "cleanup_failed"),
    results: Object.freeze(results.map((result) => Object.freeze({ ...result }))),
  });
}

export function safePs001dFailure(error: unknown) {
  const value = error instanceof Error ? error.message : String(error);
  return /^[A-Z0-9_]{1,80}$/.test(value) ? value : "PS001D_OPERATION_FAILED";
}
