import { describe, expect, it, vi } from "vitest";
import { createInvestmentOpportunityId, createOpportunityAnalysisId } from "../../domain";
import { AcquisitionPipelineVersion, createAcquisitionContingencyId, createAcquisitionOfferId, createAcquisitionStageTransitionId, createAcquisitionPipelineId, createAcquisitionActorReference, type AcquisitionOffer } from "../../acquisition-pipeline/domain";
import { createActionId } from "@/platform/actions";
import { createEvidenceId } from "@/platform/evidence";
import { buildAcquisitionWorkspace, buildAnalysisWorkspaceSummary, buildLifecycleSummary, buildNextActions, buildRequirementsSummary, getAcquisitionWorkspace, resolveAcquisitionWorkspaceLimits, type AcquisitionWorkspaceAnalysisSource, type AcquisitionWorkspaceAuthorizationSource, type AcquisitionWorkspaceDeploymentStatus, type AcquisitionWorkspaceOpportunitySource, type AcquisitionWorkspacePipelineSource, type GetAcquisitionWorkspaceDependencies } from ".";

const at = new Date("2026-07-23T12:00:00Z");
const ownerId = "owner-1", opportunityId = createInvestmentOpportunityId("investment-opportunity-workspace");
const actor = createAcquisitionActorReference({ type: "user", id: ownerId });
const opportunity: AcquisitionWorkspaceOpportunitySource = {
  id: opportunityId, ownerId, version: 4, name: "Mesa opportunity",
  location: { address1: "1 Main St", city: "Mesa", state: "AZ", postalCode: "85201", display: "1 Main St, Mesa, AZ 85201" },
  route: "purchase", status: "shortlisted", archived: false, tags: ["Value Add"], createdAt: new Date("2026-07-01T00:00:00Z"), updatedAt: at,
  headlineValue: { type: "purchase-price", amount: { amount: 425000, currency: "USD" } },
};
const analysis: AcquisitionWorkspaceAnalysisSource = { analysisId: createOpportunityAnalysisId("opportunity-analysis-workspace"), opportunityId, version: 2, analyzedAt: new Date("2026-07-20T00:00:00Z"), route: "purchase", recommendation: "buy-with-conditions", score: 82, confidence: { level: "high" }, complete: true };
const authorization: AcquisitionWorkspaceAuthorizationSource = { authenticated: true, canRead: true, capabilities: { activate: true, manageOffers: true, recordContract: true, manageRequirements: true, prepareClosing: true, close: true, exit: true } };
const deployment: AcquisitionWorkspaceDeploymentStatus = { readDeployed: true, commandsDeployed: false, remoteTransactionsVerified: false, remoteRlsVerified: false, eventDeliveryDurable: false, documentReaderAvailable: false };
const history = (to: AcquisitionWorkspacePipelineSource["stage"], day: number) => ({ transitionId: createAcquisitionStageTransitionId(`acquisition-stage-transition-${day}`), ...(to === "pursuit" ? {} : { from: "pursuit" as const }), to, occurredAt: new Date(`2026-07-${String(day).padStart(2, "0")}T00:00:00Z`), actor, classification: "forward" as const, aggregateVersion: AcquisitionPipelineVersion.from(day) });
const pipeline = (stage: AcquisitionWorkspacePipelineSource["stage"] = "pursuit"): AcquisitionWorkspacePipelineSource => ({
  id: createAcquisitionPipelineId("acquisition-pipeline-workspace").value, opportunityId, route: "purchase", stage, version: 3,
  activation: { activatedAt: new Date("2026-07-10T00:00:00Z"), activatedBy: actor },
  offers: [], responses: [], contingencies: [], dueDiligenceItems: [], stageHistory: [history("pursuit", 1), ...(stage !== "pursuit" && stage !== "exited" ? [history(stage, 2)] : [])],
  activity: [], updatedAt: at,
  ...(stage === "closed-acquired" ? { closingFacts: { route: "purchase" as const, closedAt: at, finalPurchasePrice: { amount: 420000, currency: "USD" as const }, financingType: "financed" as const } } : {}),
  ...(stage === "exited" ? { exit: { reason: "operator-withdrew" as const, exitedFromStage: "pursuit" as const, exitedAt: at, exitedBy: actor, reconsideration: { eligible: true as const, note: "Review later" } } } : {}),
});
const limits = resolveAcquisitionWorkspaceLimits({})!;

describe("Acquisition Workspace projections", () => {
  it("validates and caps collection requests", () => {
    expect(limits).toMatchObject({ activity: 12, history: 10, priorOffers: 3, requirements: 8 });
    expect(resolveAcquisitionWorkspaceLimits({ activityLimit: 51 })).toBeNull();
    expect(resolveAcquisitionWorkspaceLimits({ historyLimit: 0 })).toBeNull();
  });

  it("returns opportunity-only with latest analysis and explicit versions", () => {
    const view = buildAcquisitionWorkspace({ opportunity, analysis, pipeline: null, actionStates: [], evidenceStates: [], authorization, deployment, evaluatedAt: at, limits, actionDependencyAvailable: true, evidenceDependencyAvailable: true });
    expect(view.status).toBe("opportunity-only");
    if (view.status !== "opportunity-only") return;
    expect(view.analysis?.analysisId).toBe(analysis.analysisId.value);
    expect(view.versions).toEqual({ opportunityVersion: 4, latestAnalysisVersion: 2 });
    expect(view.activation.eligible).toBe(false);
    expect(view.capabilities.read.status).toBe("available");
    expect(view.capabilities.activate.status).toBe("not-deployed");
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.opportunity.tags)).toBe(true);
  });

  it("allows missing analysis without turning no-pipeline into an error", () => {
    const view = buildAcquisitionWorkspace({ opportunity, analysis: null, pipeline: null, actionStates: [], evidenceStates: [], authorization, deployment, evaluatedAt: at, limits, actionDependencyAvailable: true, evidenceDependencyAvailable: true });
    expect(view.status).toBe("opportunity-only");
    if (view.status === "opportunity-only") expect(view.activation.blockers.map(value => value.code)).toContain("ANALYSIS_REQUIRED");
  });

  it("classifies analysis age and centralizes historical route generation", () => {
    const stale = buildAnalysisWorkspaceSummary({ ...analysis, analyzedAt: new Date("2026-01-01T00:00:00Z") }, opportunity, at)!;
    expect(stale.age.classification).toBe("stale");
    expect(stale.stale).toBe(true);
    expect(stale.historicalAnalysisHref).toBe(`/dashboard/investments/opportunities/${opportunityId.value}/analyses/${analysis.analysisId.value}`);
    expect(() => buildAnalysisWorkspaceSummary({ ...analysis, opportunityId: createInvestmentOpportunityId("investment-opportunity-other") }, opportunity, at)).toThrow("INVALID_ANALYSIS_SOURCE");
  });

  it("returns active and acquired terminal states without leaking aggregates", () => {
    const active = buildAcquisitionWorkspace({ opportunity, analysis, pipeline: pipeline("pursuit"), actionStates: [], evidenceStates: [], authorization, deployment, evaluatedAt: at, limits, actionDependencyAvailable: true, evidenceDependencyAvailable: true });
    expect(active.status).toBe("pipeline-active");
    if (active.status === "pipeline-active") {
      expect(active.acquisition.terminal).toBe(false);
      expect(active.nextActions.filter(value => value.priority === "primary")).toHaveLength(1);
      expect(active.nextActions[0]?.command).toMatchObject({ expectedOpportunityVersion: 4, expectedPipelineVersion: 3 });
      expect(active.nextActions[0]?.command).not.toHaveProperty("actor");
    }
    const terminal = buildAcquisitionWorkspace({ opportunity: { ...opportunity, status: "acquired" }, analysis, pipeline: pipeline("closed-acquired"), actionStates: [], evidenceStates: [], authorization, deployment, evaluatedAt: at, limits, actionDependencyAvailable: true, evidenceDependencyAvailable: true });
    expect(terminal.status).toBe("pipeline-terminal");
    if (terminal.status === "pipeline-terminal") {
      expect(terminal.acquisition.outcome.type).toBe("acquired");
      expect(terminal.nextActions.some(value => value.type === "close-acquisition")).toBe(false);
    }
  });

  it("projects exited outcome outside ordinary progress", () => {
    const value = buildAcquisitionWorkspace({ opportunity: { ...opportunity, status: "rejected" }, analysis, pipeline: pipeline("exited"), actionStates: [], evidenceStates: [], authorization, deployment, evaluatedAt: at, limits, actionDependencyAvailable: true, evidenceDependencyAvailable: true });
    expect(value.status).toBe("pipeline-terminal");
    if (value.status === "pipeline-terminal" && value.acquisition.outcome.type === "exited") {
      expect(value.acquisition.lifecycle.currentStageIndex).toBe(-1);
      expect(value.acquisition.lifecycle.stages.at(-1)).toMatchObject({ stage: "exited", state: "exited" });
      expect(value.acquisition.outcome.reconsiderationEligible).toBe(true);
    }
  });

  it("uses domain transition policy and specialized command types", () => {
    const lifecycle = buildLifecycleSummary(pipeline("offer-preparation"), 10);
    expect(lifecycle.availableTransitions).toEqual(expect.arrayContaining([expect.objectContaining({ targetStage: "offer-submitted", commandType: "submit-offer" })]));
    expect(lifecycle.availableTransitions.map(value => value.targetStage)).not.toContain("closed-acquired");
  });

  it("projects closing preparation only from current blocker-free readiness", () => {
    const baseline = buildAcquisitionWorkspace({ opportunity, analysis, pipeline: pipeline("due-diligence"), actionStates: [], evidenceStates: [], authorization, deployment, evaluatedAt: at, limits, actionDependencyAvailable: true, evidenceDependencyAvailable: true });
    if (baseline.status !== "pipeline-active") throw new Error("expected active");
    const ready = { status: "ready" as const, evaluatedAt: at, evaluatedPipelineVersion: 3, current: true, blockers: [], blockerTotalCount: 0, blockersTruncated: false, warnings: [], warningTotalCount: 0, warningsTruncated: false, counts: { requiredContingencies: 0, unresolvedContingencies: 0, requiredDiligence: 0, unresolvedDiligence: 0, waived: 0, failed: 0 } };
    const capabilities = Object.fromEntries(["read", "activate", "manageOffers", "recordContract", "manageRequirements", "prepareClosing", "close", "exit"].map(name => [name, { status: "available" }])) as typeof baseline.capabilities;
    const source = { ...pipeline("due-diligence"), readiness: { status: "ready" as const, evaluatedAt: at, evaluatedPipelineVersion: 3, route: "purchase" as const, pipelineStage: "due-diligence" as const, blockers: [], warnings: [], satisfiedConditions: [], requiredContingencyCount: 0, unresolvedContingencyCount: 0, requiredDiligenceCount: 0, unresolvedDiligenceCount: 0, waivedRequirementCount: 0, failedRequirementCount: 0 } };
    const acquisition = { ...baseline.acquisition, readiness: ready };
    const actions = buildNextActions({ opportunity: baseline.opportunity, analysis: baseline.analysis, pipeline: source, acquisition, capabilities, versions: baseline.versions });
    expect(actions[0]).toMatchObject({ type: "begin-closing-preparation", command: { commandType: "prepare-closing" } });
    const stale = buildNextActions({ opportunity: baseline.opportunity, analysis: baseline.analysis, pipeline: source, acquisition: { ...acquisition, readiness: { ...ready, current: false } }, capabilities, versions: baseline.versions });
    expect(stale[0]?.type).toBe("manage-due-diligence");
  });

  it("orders and bounds prior offers by sequence", () => {
    const offer = (sequence: number, current = false): AcquisitionOffer => ({ id: createAcquisitionOfferId(`acquisition-offer-${sequence}`), pipelineId: createAcquisitionPipelineId("acquisition-pipeline-workspace"), sequence: { value: sequence }, route: "purchase", status: current ? "draft" : "superseded", sourceAnalysis: { analysisId: analysis.analysisId, analysisVersion: 2, analyzedAt: analysis.analyzedAt, route: "purchase" }, terms: { route: "purchase", offerPrice: { amount: 400000 + sequence, currency: "USD" }, financing: { type: "cash" }, conditions: [] }, createdBy: actor, createdAt: new Date(`2026-07-${10 + sequence}T00:00:00Z`), current });
    const value = buildAcquisitionWorkspace({ opportunity, analysis, pipeline: { ...pipeline(), offers: [offer(1), offer(3, true), offer(2)] }, actionStates: [], evidenceStates: [], authorization, deployment, evaluatedAt: at, limits: { ...limits, priorOffers: 1 }, actionDependencyAvailable: true, evidenceDependencyAvailable: true });
    if (value.status !== "pipeline-active") throw new Error("expected active");
    expect(value.acquisition.commercial.currentOffer?.sequence).toBe(3);
    expect(value.acquisition.commercial.priorOffers.map(item => item.sequence)).toEqual([2]);
    expect(value.acquisition.commercial.priorOffersTruncated).toBe(true);
  });

  it("counts opaque references and never returns their content", () => {
    const requirement = {
      requirementType: "contingency" as const, id: createAcquisitionContingencyId("acquisition-contingency-1"), pipelineId: createAcquisitionPipelineId("acquisition-pipeline-workspace"), route: "purchase" as const, type: "inspection" as const, title: "Inspection", status: "not-started" as const, blocking: true, priority: "critical" as const, source: { type: "operator-added" as const, explanation: "Required" }, relatedDueDiligenceItemIds: [], actionReferences: [{ actionId: createActionId("action-1"), relationship: "executes-requirement" as const }], evidenceReferences: [{ evidenceId: createEvidenceId("evidence-1"), relationship: "supports" as const }], documentReferences: [{ documentId: "document-1", relationship: "inspection" as const }], createdAt: at, createdBy: actor, updatedAt: at,
    } satisfies AcquisitionWorkspacePipelineSource["contingencies"][number];
    const summary = buildRequirementsSummary({ ...pipeline(), contingencies: [requirement] }, [{ actionId: "action-1", status: "completed", blocked: false, updatedAt: at }], [{ evidenceId: "evidence-1", available: false, state: "withdrawn", updatedAt: at }], at, 8);
    expect(summary.blocking[0]).toMatchObject({ linkedActionCount: 1, evidenceCount: 1, documentCount: 1, unavailableEvidenceCount: 1 });
    expect(summary.contingencies).toHaveLength(1);
    expect(summary.dueDiligence).toHaveLength(0);
    expect(summary.evidence).toEqual({ linked: 1, available: 0, unavailable: 1, withdrawn: 1, superseded: 0 });
    expect(summary.contingencies[0]?.evidence).toEqual(summary.evidence);
    expect(summary.blocking[0]).not.toHaveProperty("action");
    expect(summary.blocking[0]).not.toHaveProperty("evidenceContent");
    expect(summary.blocking[0]).not.toHaveProperty("documentMetadata");
    expect(summary.blocking[0]?.status).toBe("not-started");
  });
});

describe("getAcquisitionWorkspace", () => {
  function dependencies(overrides: Partial<GetAcquisitionWorkspaceDependencies> = {}): GetAcquisitionWorkspaceDependencies {
    return {
      opportunities: { findOpportunity: vi.fn(async () => opportunity) },
      analyses: { findLatestCompletedAnalysis: vi.fn(async () => analysis) },
      pipelines: { findByOpportunity: vi.fn(async () => null) },
      actions: { getActionStates: vi.fn(async () => []) },
      evidence: { getEvidenceStates: vi.fn(async () => []) },
      authorization: { authorize: vi.fn(async () => authorization) },
      deployment, now: () => at, ...overrides,
    };
  }
  const query = { ownerId, actor, opportunityId };

  it("authorizes, returns no-pipeline success, and performs no mutation", async () => {
    const deps = dependencies(), result = await getAcquisitionWorkspace(query, deps);
    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) expect(result.value.status).toBe("opportunity-only");
    expect(deps.authorization.authorize).toHaveBeenCalledBefore(deps.opportunities.findOpportunity as never);
  });

  it("rejects invalid bounds and anonymous access safely", async () => {
    const invalid = await getAcquisitionWorkspace({ ...query, activityLimit: 99 }, dependencies());
    expect(invalid.isFailure && invalid.error.code).toBe("ACQUISITION_WORKSPACE_INPUT_INVALID");
    const anonymous = await getAcquisitionWorkspace(query, dependencies({ authorization: { authorize: async () => ({ ...authorization, authenticated: false }) } }));
    expect(anonymous.isFailure && anonymous.error.code).toBe("ACQUISITION_WORKSPACE_NOT_AUTHENTICATED");
  });

  it("conceals missing and cross-owner opportunities as not found", async () => {
    const missing = await getAcquisitionWorkspace(query, dependencies({ opportunities: { findOpportunity: async () => null } }));
    expect(missing.isFailure && missing.error.code).toBe("ACQUISITION_WORKSPACE_NOT_FOUND");
    const other = await getAcquisitionWorkspace(query, dependencies({ opportunities: { findOpportunity: async () => ({ ...opportunity, ownerId: "other" }) } }));
    expect(other.isFailure && other.error.code).toBe("ACQUISITION_WORKSPACE_NOT_FOUND");
  });

  it("degrades analysis and enrichment failures but preserves the pipeline workspace", async () => {
    const result = await getAcquisitionWorkspace(query, dependencies({
      analyses: { findLatestCompletedAnalysis: async () => { throw new Error("down"); } },
      pipelines: { findByOpportunity: async () => pipeline() },
      actions: { getActionStates: async () => { throw new Error("down"); } },
      evidence: { getEvidenceStates: async () => { throw new Error("down"); } },
    }));
    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.status).toBe("pipeline-active");
      expect(result.value.analysis).toBeNull();
    }
  });

  it("returns acquisition-unavailable when pipeline persistence fails", async () => {
    const result = await getAcquisitionWorkspace(query, dependencies({ pipelines: { findByOpportunity: async () => { throw new Error("down"); } } }));
    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.status).toBe("acquisition-unavailable");
      expect(result.value.opportunity.id).toBe(opportunityId.value);
    }
  });

  it("fails corrupt canonical pipeline versions without returning partial acquisition", async () => {
    const result = await getAcquisitionWorkspace(query, dependencies({ pipelines: { findByOpportunity: async () => ({ ...pipeline(), version: 0 }) } }));
    expect(result.isFailure && result.error).toMatchObject({ code: "ACQUISITION_WORKSPACE_PIPELINE_INVALID", retryable: false });
  });
});
