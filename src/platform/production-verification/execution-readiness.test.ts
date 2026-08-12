import { describe, expect, it, vi } from "vitest";
import { AuthoritativeVerificationExecutor, CA001F_PLAN, CanonicalScenarioEvaluator, MANUAL_OBSERVATION_DEFINITIONS, RegisterControlledVerificationIdentity, RegisterProductionVerificationDefinitions, VERIFICATION_EVIDENCE_DEFINITIONS, VERIFICATION_SCENARIOS, authorizeReviewer, evaluateProductionExecutionReadiness, productionDefinitions } from ".";

describe("CA-001F published registration", () => {
  it("produces deterministic definitions for every registry component", () => {
    const first = productionDefinitions(), second = productionDefinitions();
    expect(first).toEqual(second); expect(first.filter(d => d.kind === "scenario")).toHaveLength(31);
    expect(first.filter(d => d.kind === "evidence")).toHaveLength(31);
    expect(first.some(d => d.kind === "gate_policy")).toBe(true); expect(first.some(d => d.kind === "manual_observation")).toBe(true);
  });
  it("is idempotent and rejects published drift", async () => {
    const records = new Map<string, { fingerprint: string; status: string }>();
    const repository = { find: vi.fn(async (kind: string, code: string, version: number) => records.get(`${kind}:${code}:${version}`) ?? null), publish: vi.fn(async (d: { kind: string; code: string; version: number; fingerprint: string }) => { records.set(`${d.kind}:${d.code}:${d.version}`, { fingerprint: d.fingerprint, status: "active" }); }) };
    const operation = new RegisterProductionVerificationDefinitions({ authorizeRegistration: async () => true }, repository);
    const created = await operation.execute({ actorId: "admin", environmentCode: "production", correlationId: "c" }); expect(created.created).toBe(productionDefinitions().length);
    const unchanged = await operation.execute({ actorId: "admin", environmentCode: "production", correlationId: "c2" }); expect(unchanged.unchanged).toBe(productionDefinitions().length);
    records.set("scenario:PV-001:1", { fingerprint: "drift", status: "active" }); await expect(operation.execute({ actorId: "admin", environmentCode: "production", correlationId: "c3" })).rejects.toMatchObject({ code: "PRODUCTION_REGISTRY_DRIFT" });
  });
});

describe("CA-001F authoritative adapters", () => {
  it("routes a registered executor only to its declared authority", async () => {
    const execute = vi.fn(async () => ({ stableResultCode: "OBSERVED" }));
    const authority = { execute }, authorities = Object.fromEntries(["release", "commerce", "customer_account", "onboarding", "first_value", "admin_activation", "security", "operations"].map(k => [k, authority])) as never;
    await new AuthoritativeVerificationExecutor(authorities).execute("EXECUTE_PV-003", { runId: "r", scenarioInstanceId: "s", controlledIdentityId: "i", correlationId: "c" });
    expect(execute).toHaveBeenCalledWith("EXECUTE_PV-003", expect.objectContaining({ controlledIdentityId: "i" }));
  });
  it("requires canonical run- and scenario-bound evidence", async () => {
    const evidence = { id: "e", verificationRunId: "run", scenarioInstanceId: "instance", evidenceCode: "PV-001_CANONICAL_EVIDENCE", evidenceVersion: 1, sourceDomainCode: "release", sourceResourceType: "candidate", opaqueSourceReference: "candidate", classification: "valid" as const, observedOutcomeCode: "PV-001_PASS", capturedAt: new Date(), capturedBy: "system" as const, correlationId: "c" };
    const evaluator = new CanonicalScenarioEvaluator({ release: { resolve: async () => evidence } });
    await expect(evaluator.evaluate({ runId: "run", scenarioInstanceId: "instance", candidateId: "candidate", asOf: new Date(Date.now()+1), scenarioCode: "PV-001", scenarioVersion: 1 })).resolves.toMatchObject({ passed: true });
    await expect(new CanonicalScenarioEvaluator({ release: { resolve: async () => ({ ...evidence, verificationRunId: "other" }) } }).evaluate({ runId: "run", scenarioInstanceId: "instance", candidateId: "candidate", asOf: new Date(Date.now()+1), scenarioCode: "PV-001", scenarioVersion: 1 })).rejects.toMatchObject({ code: "CANONICAL_EVIDENCE_INVALID" });
  });
});

describe("CA-001F identity and readiness boundaries", () => {
  it("registers references only after authoritative identity resolution and rejects reviewer overlap", async () => {
    const repository = { resolveAuthSubject: async () => ({ actorId: "subject", active: true, roles: ["release_verifier"], tenantIds: ["tenant"] }), find: async () => null, register: vi.fn(async () => undefined) };
    const operation = new RegisterControlledVerificationIdentity({ authorize: async () => true }, repository);
    const identity={ opaqueAuthSubjectReference: "opaque", identityTypeCode: "release_verifier", tenantId: "tenant", allowedScenarioCodes: ["PV-001"], expiresAt: new Date(Date.now()+60_000), fixtureOwnershipCode: "CONTROLLED", retentionClassification: "retain" as const };
    const first=await operation.execute({ actorId: "admin", identity, correlationId: "c" });
    expect(repository.register).toHaveBeenCalled();
    expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    await expect(authorizeReviewer({ resolve: async () => ({ active: true, roles: ["release_reviewer"] }) }, "same", "same")).rejects.toMatchObject({ code: "REVIEWER_SEPARATION_REQUIRED" });
  });
  it("rejects expired, unauthorized, cross-tenant, and drifted identity registration",async()=>{
    const identity={opaqueAuthSubjectReference:"opaque",identityTypeCode:"release_verifier",tenantId:"tenant",allowedScenarioCodes:["PV-001"],expiresAt:new Date(Date.now()+60_000),fixtureOwnershipCode:"CONTROLLED",retentionClassification:"retain" as const};
    const repository={resolveAuthSubject:async()=>({actorId:"subject",active:true,roles:[],tenantIds:["other"]}),find:async()=>null,register:vi.fn(async()=>undefined)};
    await expect(new RegisterControlledVerificationIdentity({authorize:async()=>true},repository).execute({actorId:"admin",identity,correlationId:"c"})).rejects.toMatchObject({code:"CONTROLLED_IDENTITY_NOT_AUTHORITATIVE"});
    await expect(new RegisterControlledVerificationIdentity({authorize:async()=>false},repository).execute({actorId:"admin",identity,correlationId:"c"})).rejects.toMatchObject({code:"IDENTITY_REGISTRATION_NOT_AUTHORIZED"});
    const authoritative={...repository,resolveAuthSubject:async()=>({actorId:"subject",active:true,roles:[],tenantIds:["tenant"]}),find:async()=>({fingerprint:"different"})};
    await expect(new RegisterControlledVerificationIdentity({authorize:async()=>true},authoritative).execute({actorId:"admin",identity,correlationId:"c"})).rejects.toMatchObject({code:"CONTROLLED_IDENTITY_DRIFT"});
  });
  it("fails closed until every production prerequisite resolves", async () => {
    const candidate = { id: "candidate", environmentCode: "production" as const, repositoryCode: "repo", commitSha: "sha", deploymentId: "deployment", deploymentUrl: "https://deployment.invalid", productionAlias: "https://alias.invalid", deployedAt: new Date(), databaseMigrationSetHash: "hash", latestMigrationCode: "20260811100000", registryVersions: {}, verificationPlanVersion: 1, featureConfigurationFingerprint: "fingerprint", createdAt: new Date() };
    const result = await evaluateProductionExecutionReadiness(candidate, { resolveCurrentCandidate: async () => ({ commitSha: "sha", deploymentId: "deployment", aliasDeploymentId: "deployment", latestMigrationCode: "20260812110000" }), resolveRegistry: async () => ({ planCode: CA001F_PLAN.code, planVersion: 1, scenarioCodes: VERIFICATION_SCENARIOS.map(s => s.code), evidenceCodes: VERIFICATION_EVIDENCE_DEFINITIONS.map(e => e.code), manualObservationCodes: MANUAL_OBSERVATION_DEFINITIONS.map(o => o.code), driftDetected: false }), resolveAdapters: async () => ({ executorCodes: [], evaluatorCodes: [], cleanupOperationCodes: [] }), resolveIdentities: async () => ({ activeIdentityTypeCodes: [], expiredCount: 0, verifierAuthorized: false, reviewerAuthorized: false }) });
    expect(result.ready).toBe(false); expect(result.blockerCodes).toContain("AUTHORITATIVE_ADAPTER_COVERAGE_INCOMPLETE"); expect(result.blockerCodes).toContain("CONTROLLED_IDENTITY_SET_INCOMPLETE");
  });
});
