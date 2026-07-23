import { describe, expect, it, vi } from "vitest";
import {
  AcquisitionServerCommandBoundary,
  ACQUISITION_SERVER_COMMAND_TYPES,
  acquisitionCommandRevalidationPaths,
  createFailClosedAcquisitionCommandRegistry,
  mapAcquisitionServerCommandError,
  parseAcquisitionServerCommand,
  type AcquisitionCommandDeploymentRegistry,
  type AcquisitionImplementedServerCommandInput,
  type AcquisitionServerCommandBoundaryDependencies,
} from ".";

const opportunityId = "investment-opportunity-command-boundary";
const idempotencyKey = "123e4567-e89b-42d3-a456-426614174000";
const activate: AcquisitionImplementedServerCommandInput = {
  commandType: "activate-pipeline",
  envelope: { opportunityId, expectedOpportunityVersion: 4, idempotencyKey },
  analysisId: "opportunity-analysis-command-boundary",
  analysisVersion: 2,
  route: "purchase",
};
const enabled = Object.freeze(Object.fromEntries(ACQUISITION_SERVER_COMMAND_TYPES.map((command) => [command, { status: "enabled" }])) as AcquisitionCommandDeploymentRegistry);

function dependencies(overrides: Partial<AcquisitionServerCommandBoundaryDependencies> = {}): AcquisitionServerCommandBoundaryDependencies {
  let monotonic = 0;
  return {
    identities: { resolve: vi.fn(async () => ({ authenticated: true, actor: { type: "user" as const, id: "owner-1" }, ownerId: "owner-1" })) },
    authorization: { authorize: vi.fn(async () => ({ allowed: true })) },
    deployment: enabled,
    dispatcher: { execute: vi.fn(async (_input, trusted) => ({ data: { pipelineId: "acquisition-pipeline-command-boundary", opportunityId, stage: "pursuit", pipelineVersion: 1, terminal: false }, commandId: trusted.commandId, replayed: false, pipelineVersion: 1, opportunityVersion: 5 })) },
    revalidator: { revalidate: vi.fn(async () => undefined) },
    clock: { now: () => new Date("2026-07-23T15:00:00.000Z"), monotonicNow: () => ++monotonic },
    correlationId: () => "correlation-1",
    telemetry: { record: vi.fn() },
    ...overrides,
  };
}

describe("Acquisition server transport", () => {
  it("parses a strict activation envelope without accepting trusted identities", () => {
    expect(parseAcquisitionServerCommand(activate)).toMatchObject({ ok: true });
    const polluted = { ...activate, envelope: { ...activate.envelope, ownerId: "attacker" } };
    const parsed = parseAcquisitionServerCommand(polluted);
    expect(parsed.ok).toBe(false);
  });

  it("rejects invalid IDs, versions, idempotency keys, money, route crossover, and unknown fields", () => {
    const badId = parseAcquisitionServerCommand({ ...activate, envelope: { ...activate.envelope, opportunityId: "wrong", expectedOpportunityVersion: 0, idempotencyKey: "timestamp-123" } });
    expect(badId.ok).toBe(false);
    const purchase = {
      commandType: "create-offer-draft",
      envelope: { ...activate.envelope, pipelineId: "acquisition-pipeline-one", expectedPipelineVersion: 1 },
      route: "purchase",
      sourceAnalysis: { analysisId: activate.analysisId, version: 2, analyzedAt: "2026-07-23T15:00:00.000Z", route: "purchase" },
      terms: { offerPrice: { amount: "12.345", currency: "USD" }, financing: { type: "cash" }, conditions: [], leaseTermMonths: 12 },
    };
    expect(parseAcquisitionServerCommand(purchase).ok).toBe(false);
  });

  it("keeps purchase and rental offer terms discriminated and decimal-safe", () => {
    const purchase = {
      commandType: "create-offer-draft",
      envelope: { ...activate.envelope, pipelineId: "acquisition-pipeline-one", expectedPipelineVersion: 1 },
      route: "purchase",
      sourceAnalysis: { analysisId: activate.analysisId, version: 2, analyzedAt: "2026-07-23T15:00:00.000Z", route: "purchase" },
      terms: { offerPrice: { amount: "425000.00", currency: "USD" }, financing: { type: "cash" }, conditions: [] },
    };
    expect(parseAcquisitionServerCommand(purchase).ok).toBe(true);
    expect(parseAcquisitionServerCommand({ ...purchase, route: "rental-arbitrage" }).ok).toBe(false);
  });
});

describe("Acquisition server command boundary", () => {
  it("authenticates and authorizes before deployment gating or dispatch", async () => {
    const deps = dependencies({ identities: { resolve: vi.fn(async () => ({ authenticated: false as const })) }, deployment: createFailClosedAcquisitionCommandRegistry() });
    const result = await new AcquisitionServerCommandBoundary(deps).execute(activate);
    expect(result).toEqual({ status: "not-authenticated", code: "ACQUISITION_COMMAND_NOT_AUTHENTICATED" });
    expect(deps.authorization.authorize).not.toHaveBeenCalled();
    expect(deps.dispatcher.execute).not.toHaveBeenCalled();
  });

  it("conceals cross-owner authorization and never dispatches", async () => {
    const deps = dependencies({ authorization: { authorize: vi.fn(async () => ({ allowed: false, conceal: true })) } });
    const result = await new AcquisitionServerCommandBoundary(deps).execute(activate);
    expect(result).toEqual({ status: "not-found", code: "ACQUISITION_COMMAND_TARGET_NOT_FOUND" });
    expect(deps.dispatcher.execute).not.toHaveBeenCalled();
  });

  it("fails closed for every production command until remote verification", async () => {
    const registry = createFailClosedAcquisitionCommandRegistry();
    expect(ACQUISITION_SERVER_COMMAND_TYPES.every((command) => registry[command].status !== "enabled")).toBe(true);
    const deps = dependencies({ deployment: registry });
    const result = await new AcquisitionServerCommandBoundary(deps).execute(activate);
    expect(result).toEqual({ status: "unavailable", code: "ACQUISITION_COMMAND_NOT_VERIFIED", retryable: false });
    expect(deps.dispatcher.execute).not.toHaveBeenCalled();
  });

  it("generates trusted command context, maps safe success, and revalidates canonical paths", async () => {
    const deps = dependencies();
    const result = await new AcquisitionServerCommandBoundary(deps).execute(activate);
    expect(result).toMatchObject({ status: "succeeded", data: { opportunityId, pipelineId: "acquisition-pipeline-command-boundary", opportunityVersion: 5, pipelineVersion: 1 }, receipt: { commandId: `acquisition-command-${idempotencyKey}`, outcome: "executed" } });
    expect(deps.dispatcher.execute).toHaveBeenCalledWith(activate, expect.objectContaining({
      commandId: `acquisition-command-${idempotencyKey}`,
      ownerId: "owner-1",
      actor: { type: "user", id: "owner-1" },
      requestFingerprint: expect.stringMatching(/^v1:[a-f0-9]{8}$/),
    }));
    expect(deps.revalidator.revalidate).toHaveBeenCalledWith([`/dashboard/investments`, `/dashboard/investments/opportunities`, `/dashboard/investments/opportunities/${opportunityId}`]);
  });

  it("uses the same command identity and fingerprint for a retry and changes only the fingerprint for a payload mismatch", async () => {
    const deps = dependencies();
    const boundary = new AcquisitionServerCommandBoundary(deps);
    await boundary.execute(activate);
    await boundary.execute(activate);
    const changed = { ...activate, analysisVersion: 3 };
    await boundary.execute(changed);
    const calls = vi.mocked(deps.dispatcher.execute).mock.calls;
    expect(calls[0]?.[1].commandId).toBe(calls[1]?.[1].commandId);
    expect(calls[0]?.[1].requestFingerprint).toBe(calls[1]?.[1].requestFingerprint);
    expect(calls[0]?.[1].commandId).toBe(calls[2]?.[1].commandId);
    expect(calls[0]?.[1].requestFingerprint).not.toBe(calls[2]?.[1].requestFingerprint);
  });

  it("maps version conflicts and performs no revalidation", async () => {
    const deps = dependencies({ dispatcher: { execute: vi.fn(async () => { throw { code: "ACQUISITION_PIPELINE_VERSION_CONFLICT", detail: "secret" }; }) } });
    const result = await new AcquisitionServerCommandBoundary(deps).execute(activate);
    expect(result).toEqual({ status: "conflict", code: "ACQUISITION_COMMAND_VERSION_CONFLICT", reloadRequired: true });
    expect(result).not.toHaveProperty("currentVersion");
    expect(deps.revalidator.revalidate).not.toHaveBeenCalled();
  });

  it("reports replay without returning aggregates or persistence state", async () => {
    const deps = dependencies({ dispatcher: { execute: vi.fn(async (_input, trusted) => ({ data: { pipelineId: "acquisition-pipeline-command-boundary", opportunityId, stage: "pursuit", pipelineVersion: 1, terminal: false }, commandId: trusted.commandId, replayed: true, pipelineVersion: 1, opportunityVersion: 5 })) } });
    const result = await new AcquisitionServerCommandBoundary(deps).execute(activate);
    expect(result).toMatchObject({ status: "succeeded", receipt: { outcome: "replayed" } });
    expect(result).not.toHaveProperty("aggregate");
    expect(JSON.stringify(result)).not.toContain("offers");
  });
});

describe("Acquisition server policies", () => {
  it("centralizes safe error mapping and targeted revalidation", () => {
    expect(mapAcquisitionServerCommandError({ code: "ACQUISITION_COMMAND_ID_REUSED", sql: "secret" }, "corr")).toEqual({ status: "conflict", code: "ACQUISITION_COMMAND_IDEMPOTENCY_CONFLICT", reloadRequired: false });
    expect(mapAcquisitionServerCommandError(new Error("supabase table secret"), "corr")).toEqual({ status: "failed", code: "ACQUISITION_COMMAND_FAILED", correlationId: "corr" });
    expect(acquisitionCommandRevalidationPaths("create-offer-draft", opportunityId)).toEqual([`/dashboard/investments/opportunities/${opportunityId}`]);
    expect(acquisitionCommandRevalidationPaths("close-acquisition", opportunityId)).toHaveLength(3);
  });
});
