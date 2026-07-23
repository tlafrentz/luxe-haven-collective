import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AcquisitionActivityWorkspaceItem, AcquisitionActiveWorkspace, AcquisitionTerminalWorkspace } from "../acquisition-workspace";
import { AcquisitionActivityWorkspace, filterTimeline, groupTimeline } from "./acquisition-activity-workspace";

const at = new Date("2026-07-23T18:00:00.000Z");
const activities: readonly AcquisitionActivityWorkspaceItem[] = [
  { id: "close", type: "pipeline-closed-acquired", category: "closing", occurredAt: at, actor: { type: "user", id: "operator" }, summary: "Acquisition completed", affectedObject: "Closing outcome", outcome: "Pipeline transitioned to Acquired", pipelineVersion: 9, fromStage: "closing-preparation", toStage: "closed-acquired", references: [] },
  { id: "requirement", type: "contingency-satisfied", category: "requirements", occurredAt: new Date("2026-07-22T18:00:00.000Z"), actor: { type: "user", id: "operator" }, summary: "Inspection contingency satisfied", affectedObject: "Contingency", outcome: "Requirement resolved", pipelineVersion: 8, toStage: "due-diligence", references: [{ type: "requirement", id: "inspection" }] },
  { id: "offer", type: "offer-submitted", category: "commercial", occurredAt: new Date("2026-07-17T18:00:00.000Z"), actor: { type: "user", id: "operator" }, summary: "Offer submitted", affectedObject: "Commercial position", outcome: "Waiting for counterparty response", pipelineVersion: 4, fromStage: "offer-preparation", toStage: "offer-submitted", references: [{ type: "offer", id: "offer-1" }] },
];
const workspace = {
  status: "pipeline-active",
  opportunity: { id: "opportunity", name: "Mesa Retreat", location: { display: "Mesa, AZ" }, route: "purchase", status: "under-contract", archived: false, tags: [], createdAt: at, updatedAt: at },
  analysis: { analysisId: "analysis", version: 2, analyzedAt: at, route: "purchase", recommendation: "buy", age: { days: 0, classification: "current" }, stale: false, historicalAnalysisHref: "/analysis" },
  acquisition: {
    pipelineId: "pipeline", route: "purchase", stage: "due-diligence", stageLabel: "Due diligence", stageCategory: "diligence", activatedAt: at, activatedBy: { type: "user", id: "operator" }, terminal: false,
    lifecycle: { currentStage: "due-diligence", currentStageIndex: 5, stages: [{ stage: "pursuit", label: "Pursuit", state: "completed" }, { stage: "due-diligence", label: "Due diligence", state: "current" }], availableTransitions: [], recentHistory: [], historyTotalCount: 2, historyTruncated: false },
    commercial: { currentOffer: null, priorOffers: [{ id: "offer-1", sequence: 1, status: "accepted", createdAt: at }], priorOfferTotalCount: 1, priorOffersTruncated: false, latestResponse: null, acceptedAgreement: { source: "offer", acceptedAt: at, offerId: "offer-1", externalReferencePresent: false, headlineTerms: { route: "purchase", offerPrice: { amount: 415000, currency: "USD" }, financingType: "cash" } }, contract: { id: "contract", source: "accepted-offer", route: "purchase", recordedAt: at, effectiveDate: at, headlineTerms: { route: "purchase", contractPrice: { amount: 415000, currency: "USD" }, financingType: "cash", scheduledClosingDate: at } }, analysisAlignment: null, contractAlignment: { status: "aligned", differences: [] } },
    requirements: { initialized: true, totals: { contingencies: 1, dueDiligence: 0, notStarted: 0, inProgress: 0, satisfied: 1, waived: 0, failed: 0, notApplicable: 0 }, blocking: [], blockingTotalCount: 0, blockingTruncated: false, highPriority: [], highPriorityTotalCount: 0, highPriorityTruncated: false, recentlyResolved: [], recentlyResolvedTotalCount: 1, recentlyResolvedTruncated: false, contingencies: [{ id: "inspection", kind: "contingency", title: "Inspection", typeOrCategory: "inspection", status: "satisfied", priority: "critical", blocking: true, overdue: false, linkedActionCount: 0, evidenceCount: 1, documentCount: 0, evidence: { linked: 1, available: 1, unavailable: 0, withdrawn: 0, superseded: 0 }, unavailableActionCount: 0, unavailableEvidenceCount: 0, dependencies: [], updatedAt: at }], contingencyTotalCount: 1, contingenciesTruncated: false, dueDiligence: [], dueDiligenceTotalCount: 0, dueDiligenceTruncated: false, risks: [], riskTotalCount: 0, risksTruncated: false, evidence: { linked: 1, available: 1, unavailable: 0, withdrawn: 0, superseded: 0 }, waivedCount: 0, failedCount: 0, unresolvedCriticalConcernCount: 0 },
    readiness: null, activity: { items: activities, totalCount: 3, truncated: false }, health: { level: "healthy", reasons: [] }, updatedAt: at,
  },
  capabilities: {}, nextActions: [], versions: { opportunityVersion: 2, pipelineVersion: 9 }, limitations: [],
} as unknown as AcquisitionActiveWorkspace;

describe("AcquisitionActivityWorkspace", () => {
  it("renders one unified operator timeline and bounded lineage views", () => {
    const html = renderToStaticMarkup(<AcquisitionActivityWorkspace workspace={workspace} />);
    for (const heading of ["Activity &amp; decision lineage", "Unified timeline", "Decision lineage", "Lifecycle history", "Command outcomes", "Commercial lineage", "Requirement lineage", "Evidence lineage"]) expect(html).toContain(heading);
    expect(html).toContain("Inspection contingency satisfied");
    expect(html).toContain("Pipeline transitioned to Acquired");
    expect(html).toContain('type="search"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("<details");
    expect(html).not.toMatch(/SELECT \*|supabase|evidence payload|document body/i);
  });

  it("filters business categories and searches summaries and safe metadata without reordering", () => {
    expect(filterTimeline(activities, "commercial", "").map(item => item.id)).toEqual(["offer"]);
    expect(filterTimeline(activities, "all", "counterparty response").map(item => item.id)).toEqual(["offer"]);
    expect(filterTimeline(activities, "evidence", "").map(item => item.id)).toEqual(["requirement"]);
    expect(filterTimeline(activities, "all", "nonexistent")).toEqual([]);
  });

  it("groups relative to the projection reference date", () => {
    expect(groupTimeline(activities, at).map(group => group.label)).toEqual(["Today", "Yesterday", "Earlier this week"]);
    expect(groupTimeline(activities, at).flatMap(group => group.items.map(item => item.id))).toEqual(["close", "requirement", "offer"]);
  });

  it("renders acquired and exited terminal narratives", () => {
    const acquired = { ...workspace, status: "pipeline-terminal", acquisition: { ...workspace.acquisition, terminal: true, stage: "closed-acquired", stageLabel: "Acquired", outcome: { type: "acquired", closedAt: at, closingFacts: { route: "purchase", closedAt: at, finalPurchasePrice: { amount: 415000, currency: "USD" }, financingType: "cash" } } } } as unknown as AcquisitionTerminalWorkspace;
    expect(renderToStaticMarkup(<AcquisitionActivityWorkspace workspace={acquired} />)).toContain("Acquisition complete");
    const exited = { ...acquired, acquisition: { ...acquired.acquisition, stage: "exited", stageLabel: "Exited", outcome: { type: "exited", exitedAt: at, exitedFromStage: "due-diligence", reason: "inspection-failed", reconsiderationEligible: false } } } as unknown as AcquisitionTerminalWorkspace;
    const html = renderToStaticMarkup(<AcquisitionActivityWorkspace workspace={exited} />);
    expect(html).toContain("Acquisition ended");
    expect(html).toContain("Inspection Failed");
  });
});
