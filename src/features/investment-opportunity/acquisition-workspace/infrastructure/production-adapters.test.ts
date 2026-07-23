import { describe, expect, it, vi } from "vitest";
import type { InvestmentOpportunityRepository } from "@/features/investment-opportunity/application";
import {
  InvestmentOpportunity,
  createInvestmentOpportunityId,
  createOpportunityAnalysisId,
  createOpportunityOwnerId,
  type OpportunityAnalysis,
} from "@/features/investment-opportunity/domain";
import {
  AcquisitionPipeline,
  InMemoryAcquisitionPipelineRepository,
  createAcquisitionActorReference,
  createAcquisitionCommandId,
  createAcquisitionPipelineId,
  createPipelineActivation,
} from "@/features/investment-opportunity/acquisition-pipeline";
import { createActionId } from "@/platform/actions";
import { createEvidenceId } from "@/platform/evidence";
import {
  composeAcquisitionWorkspaceProduction,
  ProductionAcquisitionWorkspaceActionReader,
  ProductionAcquisitionWorkspaceAnalysisReader,
  ProductionAcquisitionWorkspaceEvidenceReader,
  type AcquisitionWorkspacePrincipal,
} from ".";

const ownerId = "owner-1";
const actor = createAcquisitionActorReference({ type: "user", id: ownerId });
const at = new Date("2026-07-23T12:00:00.000Z");
const opportunityId = createInvestmentOpportunityId("investment-opportunity-production-workspace");
const deployment = {
  readDeployed: true,
  commandsDeployed: false,
  remoteTransactionsVerified: false,
  remoteRlsVerified: false,
  eventDeliveryDurable: false,
  documentReaderAvailable: true,
};
const principal: AcquisitionWorkspacePrincipal = {
  authenticated: true,
  actorId: ownerId,
  ownerId,
  capabilities: {
    activate: true,
    manageOffers: true,
    recordContract: true,
    manageRequirements: true,
    prepareClosing: true,
    close: true,
    exit: true,
  },
};

function opportunity() {
  return InvestmentOpportunity.create({
    id: opportunityId,
    ownerId: createOpportunityOwnerId(ownerId),
    name: "Mesa opportunity",
    route: "purchase",
    property: {
      normalizedAddress: { address1: "1 Main St", city: "Mesa", state: "AZ", postalCode: "85201" },
      displayAddress: "1 Main St, Mesa, AZ 85201",
      resolutionStatus: "user-supplied",
      capturedAt: at,
    },
    tags: ["Value Add"],
    actor,
    occurredAt: at,
  });
}

function opportunityRepository(overrides: Partial<InvestmentOpportunityRepository> = {}): InvestmentOpportunityRepository {
  const value = opportunity();
  return {
    findById: vi.fn(async (id, owner) => id.equals(opportunityId) && owner.value === ownerId ? value : null),
    save: vi.fn(async () => undefined),
    list: vi.fn(async () => ({ items: [] })),
    findAnalysisById: vi.fn(async () => null),
    listAnalyses: vi.fn(async () => []),
    ...overrides,
  };
}

function pipeline() {
  return AcquisitionPipeline.activate({
    id: createAcquisitionPipelineId("acquisition-pipeline-production-workspace"),
    opportunityId,
    route: "purchase",
    activation: createPipelineActivation({
      activatedAt: at,
      activatedBy: actor,
      sourceAnalysis: {
        analysisId: createOpportunityAnalysisId("opportunity-analysis-production-workspace"),
        analysisVersion: 1,
        analyzedAt: at,
        route: "purchase",
      },
    }),
    context: { commandId: createAcquisitionCommandId("acquisition-command-production-workspace"), actor, occurredAt: at },
  });
}

function compose(input: Readonly<{
  opportunities?: InvestmentOpportunityRepository;
  pipelines?: InMemoryAcquisitionPipelineRepository;
  principal?: AcquisitionWorkspacePrincipal;
  evidenceFails?: boolean;
}> = {}) {
  const metrics = { observeDuration: vi.fn() };
  const logger = { info: vi.fn() };
  let monotonic = 0;
  const pipelines = input.pipelines ?? new InMemoryAcquisitionPipelineRepository();
  const composed = composeAcquisitionWorkspaceProduction({
    ownerId,
    opportunities: input.opportunities ?? opportunityRepository(),
    pipelines,
    actions: { getActionStates: vi.fn(async () => []) },
    evidence: {
      getEvidenceStates: vi.fn(async () => {
        if (input.evidenceFails) throw new Error("evidence unavailable");
        return [];
      }),
    },
    principals: { getPrincipal: vi.fn(async () => input.principal ?? principal) },
    deployment,
    logger,
    metrics,
    now: () => at,
    monotonicNow: () => ++monotonic,
  });
  return { ...composed, pipelines, metrics, logger };
}

describe("Acquisition Workspace production composition", () => {
  it("loads an owner-scoped opportunity-only workspace and reports safe instrumentation", async () => {
    const runtime = compose();
    const result = await runtime.getAcquisitionWorkspace.execute({ ownerId, actor, opportunityId });
    expect(result.isSuccess && result.value.status).toBe("opportunity-only");
    expect(runtime.metrics.observeDuration).toHaveBeenCalledWith("authorization", expect.any(Number), "success");
    expect(runtime.metrics.observeDuration).toHaveBeenCalledWith("opportunity-reader", expect.any(Number), "success");
    expect(runtime.metrics.observeDuration).toHaveBeenCalledWith("projection", expect.any(Number), "success");
    expect(runtime.metrics.observeDuration).toHaveBeenCalledWith("total", expect.any(Number), "success");
    expect(runtime.logger.info).toHaveBeenCalledWith("acquisition_workspace_query_completed", expect.objectContaining({
      opportunityId: opportunityId.value,
      ownerId,
      resultState: "opportunity-only",
    }));
    expect(runtime.logger.info.mock.calls[0]?.[1]).not.toHaveProperty("financials");
  });

  it("returns an active pipeline restored by the repository without exposing the aggregate", async () => {
    const runtime = compose();
    await runtime.pipelines.save(pipeline());
    const result = await runtime.getAcquisitionWorkspace.execute({ ownerId, actor, opportunityId });
    expect(result.isSuccess && result.value.status).toBe("pipeline-active");
    if (!result.isSuccess || result.value.status !== "pipeline-active") return;
    expect(result.value.acquisition.pipelineId).toBe("acquisition-pipeline-production-workspace");
    expect(result.value.acquisition).not.toHaveProperty("props");
    expect(result.value.versions.pipelineVersion).toBe(1);
    expect(runtime.logger.info).toHaveBeenCalledWith("acquisition_workspace_query_completed", expect.objectContaining({
      pipelineId: "acquisition-pipeline-production-workspace",
    }));
  });

  it("authorizes before opportunity loading and denies an owner mismatch", async () => {
    const opportunities = opportunityRepository();
    const runtime = compose({ opportunities, principal: { ...principal, ownerId: "other-owner" } });
    const result = await runtime.getAcquisitionWorkspace.execute({ ownerId, actor, opportunityId });
    expect(result.isFailure && result.error.code).toBe("ACQUISITION_WORKSPACE_NOT_AUTHORIZED");
    expect(opportunities.findById).not.toHaveBeenCalled();
  });

  it("preserves the opportunity when pipeline hydration fails", async () => {
    const pipelines = new InMemoryAcquisitionPipelineRepository();
    vi.spyOn(pipelines, "findByOpportunity").mockRejectedValue(new Error("invalid persisted aggregate"));
    const result = await compose({ pipelines }).getAcquisitionWorkspace.execute({ ownerId, actor, opportunityId });
    expect(result.isSuccess && result.value.status).toBe("acquisition-unavailable");
  });
});

describe("Acquisition Workspace production readers", () => {
  it("selects the latest completed analysis deterministically", async () => {
    const source = (sequence: number, id: string) => ({
      id: createOpportunityAnalysisId(id),
      sequence,
      props: {
        id: createOpportunityAnalysisId(id),
        opportunityId,
        sequence,
        route: "purchase",
        resultSnapshot: {
          analyzedAt: at,
          recommendation: { recommendation: "buy" },
          score: { value: 80 + sequence },
          confidence: { level: "high" },
        },
      },
    }) as unknown as OpportunityAnalysis;
    const reader = new ProductionAcquisitionWorkspaceAnalysisReader(opportunityRepository({
      listAnalyses: vi.fn(async () => [source(1, "opportunity-analysis-one"), source(2, "opportunity-analysis-two")]),
    }));
    await expect(reader.findLatestCompletedAnalysis({ ownerId, opportunityId })).resolves.toMatchObject({
      version: 2,
      score: 82,
      complete: true,
    });
  });

  it("returns bounded current Action state without body or history", async () => {
    const reader = new ProductionAcquisitionWorkspaceActionReader({
      getActionStates: async () => [{
        actionId: createActionId("action-workspace"),
        status: "committed",
        blocked: false,
        updatedAt: at,
      }],
    });
    const result = await reader.getActionStates({ ownerId, actionIds: ["action-workspace"] });
    expect(result).toEqual([{ actionId: "action-workspace", status: "committed", blocked: false, updatedAt: at }]);
    expect(result[0]).not.toHaveProperty("title");
    await expect(reader.getActionStates({ ownerId, actionIds: Array.from({ length: 26 }, (_, index) => `action-${index}`) })).rejects.toMatchObject({ code: "ACTION_READ_FAILED" });
  });

  it("maps the existing owner-scoped Evidence port to availability only", async () => {
    const evidenceId = createEvidenceId("evidence-workspace");
    const reader = new ProductionAcquisitionWorkspaceEvidenceReader({
      getEvidenceStates: async () => [{ evidenceId, exists: true, available: false }],
    });
    const result = await reader.getEvidenceStates({ ownerId, evidenceIds: [evidenceId.value] });
    expect(result).toEqual([{ evidenceId: evidenceId.value, available: false, state: "unavailable" }]);
    expect(result[0]).not.toHaveProperty("title");
    expect(result[0]).not.toHaveProperty("provenance");
  });
});
