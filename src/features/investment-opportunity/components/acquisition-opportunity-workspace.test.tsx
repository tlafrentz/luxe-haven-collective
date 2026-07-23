import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AcquisitionPipelineVersion,
  createAcquisitionActorReference,
  createAcquisitionPipelineId,
  createAcquisitionStageTransitionId,
} from "../acquisition-pipeline";
import { createInvestmentOpportunityId, createOpportunityAnalysisId } from "../domain";
import {
  buildAcquisitionWorkspace,
  getAcquisitionWorkspace,
  resolveAcquisitionWorkspaceLimits,
  type AcquisitionWorkspaceAnalysisSource,
  type AcquisitionWorkspaceAuthorizationSource,
  type AcquisitionWorkspaceDeploymentStatus,
  type AcquisitionWorkspaceOpportunitySource,
  type AcquisitionWorkspacePipelineSource,
} from "../acquisition-workspace";
import { AcquisitionOpportunityWorkspace } from "./acquisition-opportunity-workspace";

const at = new Date("2026-07-23T18:00:00.000Z");
const ownerId = "owner-detail-workspace";
const actor = createAcquisitionActorReference({ type: "user", id: ownerId });
const opportunityId = createInvestmentOpportunityId("investment-opportunity-detail-workspace");
const opportunity: AcquisitionWorkspaceOpportunitySource = {
  id: opportunityId,
  ownerId,
  version: 3,
  name: "Mesa Downtown Retreat",
  location: { address1: "1 Main St", city: "Mesa", state: "AZ", postalCode: "85201", display: "1 Main St, Mesa, AZ 85201" },
  route: "purchase",
  status: "shortlisted",
  archived: false,
  tags: ["Value Add"],
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: at,
  headlineValue: { type: "purchase-price", amount: { amount: 425000, currency: "USD" } },
};
const analysis: AcquisitionWorkspaceAnalysisSource = {
  analysisId: createOpportunityAnalysisId("opportunity-analysis-detail-workspace"),
  opportunityId,
  version: 2,
  analyzedAt: new Date("2026-07-20T00:00:00.000Z"),
  route: "purchase",
  recommendation: "buy-with-conditions",
  score: 82,
  confidence: { level: "high" },
  complete: true,
};
const authorization: AcquisitionWorkspaceAuthorizationSource = { authenticated: true, canRead: true, capabilities: { activate: true, manageOffers: true, recordContract: true, manageRequirements: true, prepareClosing: true, close: true, exit: true } };
const deployment: AcquisitionWorkspaceDeploymentStatus = { readDeployed: true, commandsDeployed: false, remoteTransactionsVerified: false, remoteRlsVerified: false, eventDeliveryDurable: false, documentReaderAvailable: false };
const limits = resolveAcquisitionWorkspaceLimits({})!;
function history(to: AcquisitionWorkspacePipelineSource["stage"], version: number, from?: AcquisitionWorkspacePipelineSource["stage"]) {
  return { transitionId: createAcquisitionStageTransitionId(`acquisition-stage-transition-detail-${version}`), ...(from ? { from } : {}), to, occurredAt: new Date(at.getTime() + version), actor, classification: to === "closed-acquired" ? "terminal" as const : "forward" as const, aggregateVersion: AcquisitionPipelineVersion.from(version) };
}
function pipeline(stage: AcquisitionWorkspacePipelineSource["stage"] = "pursuit"): AcquisitionWorkspacePipelineSource {
  const stageHistory = stage === "pursuit" ? [history("pursuit", 1)] : [history("pursuit", 1), history(stage, 2, "pursuit")];
  return {
    id: createAcquisitionPipelineId("acquisition-pipeline-detail-workspace").value,
    opportunityId,
    route: "purchase",
    stage,
    version: stageHistory.length,
    activation: { activatedAt: at, activatedBy: actor },
    offers: [],
    responses: [],
    contingencies: [],
    dueDiligenceItems: [],
    stageHistory,
    activity: [],
    updatedAt: at,
    ...(stage === "closed-acquired" ? { closingFacts: { route: "purchase" as const, closedAt: at, finalPurchasePrice: { amount: 420000, currency: "USD" as const }, financingType: "financed" as const } } : {}),
  };
}
function view(source: AcquisitionWorkspacePipelineSource | null, sourceOpportunity = opportunity) {
  return buildAcquisitionWorkspace({ opportunity: sourceOpportunity, analysis, pipeline: source, actionStates: [], evidenceStates: [], authorization, deployment, evaluatedAt: at, limits, actionDependencyAvailable: true, evidenceDependencyAvailable: true });
}

describe("AcquisitionOpportunityWorkspace", () => {
  it("renders opportunity-only as a successful workspace with decision and activation guidance", () => {
    const html = renderToStaticMarkup(<AcquisitionOpportunityWorkspace workspace={view(null)} />);
    expect(html).toContain("Mesa Downtown Retreat");
    expect(html).toContain("Decision context");
    expect(html).toContain("No acquisition pursuit yet");
    expect(html).not.toContain("Acquisition state unavailable");
  });

  it("renders active lifecycle, commercial, requirements, readiness, activity, and next actions", () => {
    const html = renderToStaticMarkup(<AcquisitionOpportunityWorkspace workspace={view(pipeline())} />);
    for (const heading of ["Acquisition lifecycle", "Commercial", "Requirements", "Closing readiness", "Recent activity", "Next actions"]) expect(html).toContain(heading);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Requirements have not yet been initialized.");
    expect(html).toContain("Command controls are deferred");
  });

  it("renders an acquired terminal outcome and keeps the historical lifecycle", () => {
    const html = renderToStaticMarkup(<AcquisitionOpportunityWorkspace workspace={view(pipeline("closed-acquired"), { ...opportunity, status: "acquired" })} />);
    expect(html).toContain("Terminal outcome");
    expect(html).toContain("Opportunity acquired");
    expect(html).toContain("Acquired");
  });

  it("keeps the opportunity visible when acquisition persistence is unavailable", async () => {
    const result = await getAcquisitionWorkspace({ ownerId, actor, opportunityId }, {
      opportunities: { findOpportunity: async () => opportunity },
      analyses: { findLatestCompletedAnalysis: async () => analysis },
      pipelines: { findByOpportunity: async () => { throw new Error("private persistence error"); } },
      actions: { getActionStates: async () => [] },
      evidence: { getEvidenceStates: async () => [] },
      authorization: { authorize: async () => authorization },
      deployment,
      now: () => at,
    });
    if (!result.isSuccess) throw new Error("Expected degraded success.");
    const html = renderToStaticMarkup(<AcquisitionOpportunityWorkspace workspace={result.value} />);
    expect(html).toContain("Mesa Downtown Retreat");
    expect(html).toContain("Acquisition state unavailable");
    expect(html).not.toContain("private persistence error");
  });

  it("uses canonical breadcrumbs and historical-analysis navigation", () => {
    const html = renderToStaticMarkup(<AcquisitionOpportunityWorkspace workspace={view(null)} />);
    expect(html).toContain("Investment Intelligence");
    expect(html).toContain("Opportunity Portfolio");
    expect(html).toContain(`/dashboard/investments/opportunities/${opportunityId.value}/analyses/${analysis.analysisId.value}`);
  });
});
