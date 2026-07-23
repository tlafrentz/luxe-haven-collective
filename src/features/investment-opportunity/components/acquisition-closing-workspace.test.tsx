import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AcquisitionActiveWorkspace, AcquisitionTerminalWorkspace, AcquisitionWorkspaceNextAction } from "../acquisition-workspace";
import { AcquisitionClosingWorkspace, ClosingConfirmationDialog, buildClosingChecks, isClosingActionType } from "./acquisition-closing-workspace";

vi.mock("@/app/actions/acquisition-workspace-commands", () => ({ closeAcquisitionAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const at = new Date("2026-07-23T18:00:00.000Z");
const action: AcquisitionWorkspaceNextAction = {
  id: "close-acquisition",
  type: "close-acquisition",
  label: "Close acquisition",
  description: "Record the terminal acquisition outcome.",
  enabled: false,
  priority: "primary",
  command: { commandType: "close", opportunityId: "opportunity-closing", pipelineId: "pipeline-closing", expectedOpportunityVersion: 4, expectedPipelineVersion: 8 },
  blockers: [{ code: "REMOTE_INFRASTRUCTURE_NOT_VERIFIED", message: "Required infrastructure is not verified." }],
};
const active = {
  status: "pipeline-active",
  opportunity: { id: "opportunity-closing", name: "Mesa Downtown Retreat", location: { display: "Mesa, AZ" }, route: "purchase", status: "under-contract", archived: false, tags: [], createdAt: at, updatedAt: at },
  analysis: null,
  acquisition: {
    pipelineId: "pipeline-closing",
    route: "purchase",
    stage: "closing-preparation",
    stageLabel: "Closing preparation",
    stageCategory: "closing",
    activatedAt: at,
    activatedBy: { type: "user", id: "operator" },
    terminal: false,
    lifecycle: { currentStage: "closing-preparation", currentStageIndex: 6, stages: [], availableTransitions: [], recentHistory: [], historyTotalCount: 0, historyTruncated: false },
    commercial: {
      currentOffer: null, priorOffers: [], priorOfferTotalCount: 0, priorOffersTruncated: false, latestResponse: null,
      acceptedAgreement: { source: "offer", acceptedAt: at, offerId: "offer", externalReferencePresent: false, headlineTerms: { route: "purchase", offerPrice: { amount: 415000, currency: "USD" }, financingType: "financed" } },
      contract: { id: "contract", source: "accepted-offer", route: "purchase", recordedAt: at, effectiveDate: at, headlineTerms: { route: "purchase", contractPrice: { amount: 415000, currency: "USD" }, financingType: "financed", scheduledClosingDate: at } },
      analysisAlignment: null, contractAlignment: { status: "aligned", differences: [] },
    },
    requirements: {
      initialized: true,
      totals: { contingencies: 1, dueDiligence: 1, notStarted: 0, inProgress: 0, satisfied: 2, waived: 0, failed: 0, notApplicable: 0 },
      blocking: [], blockingTotalCount: 0, blockingTruncated: false, highPriority: [], highPriorityTotalCount: 0, highPriorityTruncated: false,
      recentlyResolved: [], recentlyResolvedTotalCount: 0, recentlyResolvedTruncated: false, contingencies: [], contingencyTotalCount: 1, contingenciesTruncated: false,
      dueDiligence: [], dueDiligenceTotalCount: 1, dueDiligenceTruncated: false, risks: [], riskTotalCount: 0, risksTruncated: false,
      evidence: { linked: 2, available: 2, unavailable: 0, withdrawn: 0, superseded: 0 }, waivedCount: 0, failedCount: 0, unresolvedCriticalConcernCount: 0,
    },
    readiness: { status: "ready", evaluatedAt: at, evaluatedPipelineVersion: 8, current: true, blockers: [], blockerTotalCount: 0, blockersTruncated: false, warnings: [], warningTotalCount: 0, warningsTruncated: false, counts: { requiredContingencies: 1, unresolvedContingencies: 0, requiredDiligence: 1, unresolvedDiligence: 0, waived: 0, failed: 0 } },
    activity: { items: [], totalCount: 0, truncated: false },
    health: { level: "healthy", reasons: [] },
    updatedAt: at,
  },
  capabilities: {},
  nextActions: [action],
  versions: { opportunityVersion: 4, pipelineVersion: 8, readinessPipelineVersion: 8 },
  limitations: [],
} as unknown as AcquisitionActiveWorkspace;

describe("AcquisitionClosingWorkspace", () => {
  it("renders the operational readiness, checklist, facts, blockers, and fail-closed action", () => {
    const html = renderToStaticMarkup(<AcquisitionClosingWorkspace workspace={active} primaryAction={action} />);
    for (const value of ["Closing workspace", "Closing readiness", "Current closing objective", "Closing checklist", "Outstanding conditions", "Closing facts", "Acquisition summary"]) expect(html).toContain(value);
    expect(html).toContain("Final purchase price");
    expect(html).toContain("$415,000");
    expect(html).toContain("Required infrastructure is not verified.");
    expect(html).toContain("Commercial basis consistent");
    expect(html).not.toContain("document URL");
  });

  it("keeps blockers and warnings distinct and identifies stale readiness", () => {
    const stale = { ...active, acquisition: { ...active.acquisition, readiness: { ...active.acquisition.readiness!, current: false, status: "conditionally-ready" as const, warnings: [{ code: "WAIVED", title: "Waived inspection", explanation: "Review the accepted risk." }], warningTotalCount: 1 } } } as AcquisitionActiveWorkspace;
    const html = renderToStaticMarkup(<AcquisitionClosingWorkspace workspace={stale} primaryAction={action} />);
    expect(html).toContain("Readiness must be re-evaluated before closing.");
    expect(html).toContain("Blockers");
    expect(html).toContain("Warnings");
    expect(html).toContain("Waived inspection");
  });

  it("renders an intentional acquired terminal experience with permanent closing facts", () => {
    const terminal = { ...active, status: "pipeline-terminal", opportunity: { ...active.opportunity, status: "acquired" }, acquisition: { ...active.acquisition, stage: "closed-acquired", stageLabel: "Acquired", terminal: true, outcome: { type: "acquired", closedAt: at, closingFacts: { route: "purchase", closedAt: at, finalPurchasePrice: { amount: 415000, currency: "USD" }, financingType: "financed" } } } } as unknown as AcquisitionTerminalWorkspace;
    const html = renderToStaticMarkup(<AcquisitionClosingWorkspace workspace={terminal} primaryAction={null} />);
    expect(html).toContain("Acquisition complete");
    expect(html).toContain("Active actions");
    expect(html).toContain("None");
    expect(html).toContain("Completed closing timeline");
  });

  it("provides an accessible explicit confirmation dialog", () => {
    const html = renderToStaticMarkup(<ClosingConfirmationDialog confirmed={false} setConfirmed={vi.fn()} pending={false} phase="idle" onCancel={vi.fn()} onSubmit={vi.fn()} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("I reviewed readiness");
    expect(html).toContain("Close acquisition");
  });

  it("classifies only projected closing actions", () => {
    expect(isClosingActionType("close-acquisition")).toBe(true);
    expect(isClosingActionType("begin-closing-preparation")).toBe(true);
    expect(isClosingActionType("create-offer")).toBe(false);
    expect(buildClosingChecks(active, action).some(check => check.status === "unavailable")).toBe(true);
  });
});
