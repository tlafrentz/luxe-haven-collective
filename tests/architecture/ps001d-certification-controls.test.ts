import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  evaluatePs001dPreflight,
  evaluatePs001dFixtureStage,
  executePs001dControlledCreation,
  PS001D_RESOURCE_TYPES,
  PS001D_SCENARIOS,
  reconcilePs001dCleanup,
  safePs001dFailure,
  type Ps001dIdentityAuthorization,
  type Ps001dLedgerResource,
} from "@/platform/production-verification/ps001d-certification-controls";

const migration = [
  readFileSync("supabase/migrations/20260824001000_ps001d_certification_controls.sql", "utf8"),
  readFileSync("supabase/migrations/20260824020000_ps001d_two_stage_controlled_fixtures.sql", "utf8"),
].join("\n");
const binding = { candidateCommit: "a".repeat(40), deploymentId: "dpl_candidate", tenantId: "tenant-a", correlationId: "ps001d-00000000-0000-4000-8000-000000000001" } as const;
const now = new Date("2026-08-24T01:00:00Z");
const authorizations = PS001D_SCENARIOS.map((scenario): Ps001dIdentityAuthorization => ({
  ...binding,
  scenario,
  ...(scenario === "anonymous" ? {} : { userId: `user-${scenario}` }),
  expectedRole: scenario === "anonymous" ? "anonymous" : scenario,
  tenantRelationship: scenario === "anonymous" ? "unauthenticated" : scenario === "admin" ? "platform_admin" : scenario === "wrong_tenant" ? "wrong_tenant" : "active_member",
  validFrom: new Date("2026-08-24T00:00:00Z"),
  expiresAt: new Date("2026-08-24T02:00:00Z"),
}));
const ready = () => ({ expected: binding, deployed: binding, aliasDeploymentId: binding.deploymentId, migrationParity: true, requiredConfigurationPresent: true, fs008AndCatalogUnchanged: true, claimAvailable: true, ledgerAvailable: true, cleanupAvailable: true, activeClaimConflict: false, controlledTenant: { tenantId: binding.tenantId, designation: "PS001D_VERIFICATION_ONLY_NON_CUSTOMER", approved: true, expiresAt: new Date("2026-09-01T00:00:00Z"), hasCustomerRelationships: false, hasProviderRelationships: false, hasPaymentRelationships: false, hasPublicationRelationships: false, hasAutomationRelationships: false, hasCatalogRelationships: false }, authorizations, now });

describe("PS-001D certification enablement", () => {
  it("implements atomic concurrent one-shot acquisition and permanent replay rejection", () => {
    expect(migration).toContain("unique (candidate_commit,deployment_id,tenant_id,correlation_id)");
    expect(migration).toContain("ps001d_one_active_claim_per_target");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("exception when unique_violation then raise exception 'PS001D_CLAIM_UNAVAILABLE'");
    expect(migration).toContain("for update");
    expect(migration).toContain("PS001D_CLAIM_TERMINAL");
    expect(migration).toContain("new.status not in ('consumed','completed','failed','expired')");
    expect(migration).not.toMatch(/reset_ps001d|delete from public\.ps001d_verification_claims/i);
  });

  it("rejects binding substitution, unauthorized acquisition, and post-consumption reset", () => {
    for (const field of ["candidate_commit","deployment_id","tenant_id","correlation_id","operator_id","acquired_at","expires_at"]) expect(migration).toContain(field);
    expect(migration).toContain("PS001D_CLAIM_BINDING_MISMATCH");
    expect(migration).toContain("PS001D_ADMIN_REQUIRED");
    expect(migration).toContain("auth.role() <> 'service_role'");
    expect(migration).toContain("PS001D_CLAIM_CONSUMPTION_IMMUTABLE");
    expect(evaluatePs001dPreflight({ ...ready(), deployed: { ...binding, tenantId: "tenant-b" } }).ready).toBe(false);
  });

  it("requires exact, current, non-revoked persona authorization without granting permissions", () => {
    expect(evaluatePs001dPreflight(ready()).ready).toBe(true);
    expect(evaluatePs001dPreflight({ ...ready(), authorizations: authorizations.slice(1) }).blockerCodes).toContain("PS001D_ADMIN_AUTHORIZATION_INVALID");
    expect(evaluatePs001dPreflight({ ...ready(), authorizations: authorizations.map((value) => value.scenario === "authorized_owner" ? { ...value, revokedAt: now } : value) }).blockerCodes).toContain("PS001D_AUTHORIZED_OWNER_AUTHORIZATION_INVALID");
    expect(migration).toContain("These records authorize verification use only");
    expect(migration).not.toMatch(/grant .* on .* to .*ps001d/i);
  });

  it("models wrong-tenant and anonymous scenarios without a fabricated anonymous identity", () => {
    expect(migration).toContain("scenario = 'anonymous' and user_id is null");
    expect(migration).toContain("workspace_id<>p_tenant_id");
    expect(migration).toContain("workspace_id=p_tenant_id and status='active'");
  });

  it("reserves only typed tenant-bound resources before exposure", () => {
    expect(PS001D_RESOURCE_TYPES).not.toContain("table" as never);
    expect(migration).toContain("status='reserved'");
    expect(migration).toContain("set status='created',exposed_at=now()");
    expect(migration).not.toMatch(/p_(table|sql|url|delete)/i);
    expect(migration).toContain("ps001d_ledger_claim_tenant_fk");
  });

  it("fails closed before domain creation when transactional ledger reservation fails", async () => {
    const create = vi.fn(async () => ({ id: "property" }));
    await expect(executePs001dControlledCreation({
      resource: { claimId: "claim", tenantId: "tenant-a", type: "property", canonicalId: "property", dependencyOrder: 1 },
      reserve: vi.fn(async () => { throw new Error("PS001D_LEDGER_UNAVAILABLE"); }),
      createThroughDomainBoundary: create,
      markCreated: vi.fn(),
    })).rejects.toThrow("PS001D_LEDGER_UNAVAILABLE");
    expect(create).not.toHaveBeenCalled();
  });

  it("cleans in reverse dependency order and is idempotent across partial recovery", async () => {
    const resources: Ps001dLedgerResource[] = [
      { ledgerId: "parent", claimId: "claim", tenantId: "tenant-a", type: "property", canonicalId: "p", dependencyOrder: 1, status: "created" },
      { ledgerId: "child", claimId: "claim", tenantId: "tenant-a", type: "booking", canonicalId: "b", dependencyOrder: 2, status: "cleanup_failed" },
      { ledgerId: "done", claimId: "claim", tenantId: "tenant-a", type: "report_request", canonicalId: "r", dependencyOrder: 3, status: "cleaned" },
    ];
    const order: string[] = [], record = vi.fn(async () => undefined);
    const handler = async (resource: Ps001dLedgerResource) => { order.push(resource.ledgerId); return "cleaned" as const; };
    const handlers = Object.fromEntries(PS001D_RESOURCE_TYPES.map((type) => [type, handler])) as never;
    const result = await reconcilePs001dCleanup({ claimId: "claim", tenantId: "tenant-a", resources, handlers, record });
    expect(order).toEqual(["child", "parent"]);
    expect(result.resolved).toBe(true);
    expect(record).toHaveBeenCalledTimes(2);
  });

  it("rejects cross-tenant cleanup and records sanitized retryable failure", async () => {
    const resource: Ps001dLedgerResource = { ledgerId: "x", claimId: "claim", tenantId: "tenant-b", type: "property", canonicalId: "p", dependencyOrder: 1, status: "created" };
    await expect(reconcilePs001dCleanup({ claimId: "claim", tenantId: "tenant-a", resources: [resource], handlers: {} as never, record: vi.fn() })).rejects.toThrow("PS001D_CLEANUP_SCOPE_MISMATCH");
    expect(safePs001dFailure(new Error("database secret detail"))).toBe("PS001D_OPERATION_FAILED");
    expect(safePs001dFailure(new Error("PS001D_CLEANUP_FAILED"))).toBe("PS001D_CLEANUP_FAILED");
  });

  it("fails preflight closed for claim, cleanup, migration, alias, and scope isolation", () => {
    const result = evaluatePs001dPreflight({ ...ready(), aliasDeploymentId: "wrong", migrationParity: false, fs008AndCatalogUnchanged: false, claimAvailable: false, cleanupAvailable: false, activeClaimConflict: true });
    expect(result.ready).toBe(false);
    for (const blocker of ["PS001D_ALIAS_MISMATCH","PS001D_MIGRATION_MISMATCH","PS001D_SCOPE_ISOLATION_FAILED","PS001D_CLAIM_UNAVAILABLE","PS001D_CLEANUP_UNAVAILABLE"]) expect(result.blockerCodes).toContain(blocker);
  });

  it("allows a dormant approved controlled tenant before claim without requiring fixtures", () => {
    expect(evaluatePs001dPreflight(ready())).toEqual({ ready: true, blockerCodes: [] });
    expect(evaluatePs001dFixtureStage({ claimStatus: "unavailable", propertyCount: 0, bookingCount: 0 }).blockerCodes).toContain("PS001D_FIXTURE_CLAIM_REQUIRED");
  });

  it("rejects real-customer and relationship-bearing tenants", () => {
    const realCustomer = { ...ready(), controlledTenant: { ...ready().controlledTenant, designation: "CUSTOMER", hasCustomerRelationships: true } };
    expect(evaluatePs001dPreflight(realCustomer).blockerCodes).toEqual(expect.arrayContaining(["PS001D_CONTROLLED_TENANT_INVALID", "PS001D_CONTROLLED_TENANT_RELATIONSHIP_INVALID"]));
    expect(migration).toContain("PS001D_VERIFICATION_ONLY_NON_CUSTOMER");
    expect(migration).toContain("not exists(select 1 from public.customer_accounts");
  });

  it("requires a consumed claim before property or booking fixture creation", () => {
    expect(migration).toContain("v_claim.status<>'consumed'");
    expect(migration).toContain("PS001D_FIXTURE_CLAIM_REQUIRED");
    expect(evaluatePs001dFixtureStage({ claimStatus: "acquired", propertyCount: 0, bookingCount: 0 }).ready).toBe(false);
    expect(evaluatePs001dFixtureStage({ claimStatus: "consumed", propertyCount: 0, bookingCount: 0 }).ready).toBe(true);
  });

  it("creates each fixture atomically with its typed ledger entry and rejects duplication", () => {
    expect(migration).toMatch(/insert into public\.ps001d_verification_resource_ledger[\s\S]*insert into public\.properties/);
    expect(migration).toMatch(/insert into public\.ps001d_verification_resource_ledger[\s\S]*insert into public\.bookings/);
    expect(migration).toContain("properties_ps001d_claim_fixture_uidx");
    expect(migration).toContain("bookings_ps001d_claim_fixture_uidx");
    expect(migration).toContain("PS001D_FIXTURE_DUPLICATE");
  });

  it("binds booking to the claimed tenant property and suppresses external effects", () => {
    expect(migration).toContain("owner_id=p_tenant_id and ps001d_synthetic and ps001d_claim_id=p_claim_id");
    expect(migration).toContain("PS001D_PROPERTY_SCOPE_MISMATCH");
    for (const boundary of ["external_provider is null", "stripe_payment_intent_id is null", "payment_status='unpaid'", "status='pending'", "ps001d_side_effects_suppressed"]) expect(migration).toContain(boundary);
    expect(migration).toContain("notifications, providers, payments, publication, automation, and catalog effects suppressed");
    expect(migration.match(/if new\.ps001d_synthetic then return new; end if;/g)).toHaveLength(2);
    expect(migration).toContain("populate_property_workspace_configuration");
    expect(migration).toContain("queue_booking_quality_re_evaluation");
  });

  it("cleans booking before property and remains retryable after partial fixture creation", () => {
    const bookingDelete = migration.indexOf("delete from public.bookings b using public.ps001d_verification_resource_ledger");
    const propertyDelete = migration.indexOf("delete from public.properties p using public.ps001d_verification_resource_ledger");
    expect(bookingDelete).toBeGreaterThan(0);
    expect(propertyDelete).toBeGreaterThan(bookingDelete);
    expect(migration).toContain("status not in('cleaned','retained')");
    expect(migration).toContain("not exists(select 1 from public.ps001d_verification_resource_ledger where claim_id=p_claim_id and status not in('cleaned','retained'))");
  });

  it("keeps FS-008, catalog, generic attempts, impersonation, and arbitrary execution outside scope", () => {
    expect(migration).not.toMatch(/production_verification_attempts|impersonat|execute\s+arbitrary|commercial_catalog|furnishing_catalog|FS-008/i);
  });
});
