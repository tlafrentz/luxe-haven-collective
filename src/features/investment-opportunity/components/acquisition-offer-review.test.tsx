import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  AcquisitionAlignmentWorkspaceSummary,
  AcquisitionOfferWorkspaceSummary,
  AcquisitionWorkspaceNextAction,
  InvestmentAnalysisWorkspaceSummary,
} from "../acquisition-workspace";
import {
  buildOfferReviewChecks,
  OfferReviewWorkspace,
  SubmissionConfirmationDialog,
} from "./acquisition-offer-review";

vi.mock("@/app/actions/acquisition-workspace-commands", () => ({
  submitAcquisitionOfferAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const at = new Date("2026-07-25T12:00:00.000Z");
const analysis: InvestmentAnalysisWorkspaceSummary = {
  analysisId: "analysis-offer-review",
  version: 3,
  analyzedAt: at,
  route: "purchase",
  recommendation: "buy",
  score: 84,
  confidence: { level: "high" },
  age: { days: 2, classification: "current" },
  stale: false,
  historicalAnalysisHref: "/analysis",
};
const purchaseOffer: AcquisitionOfferWorkspaceSummary = {
  id: "offer-review-purchase",
  sequence: 2,
  status: "draft",
  route: "purchase",
  createdAt: at,
  expiresAt: new Date("2026-07-28T12:00:00.000Z"),
  sourceAnalysis: { analysisId: analysis.analysisId, version: analysis.version, analyzedAt: analysis.analyzedAt },
  headlineTerms: { route: "purchase", offerPrice: { amount: 415_000, currency: "USD" }, financingType: "cash", proposedClosingDate: new Date("2026-08-25T00:00:00.000Z") },
  current: true,
  editable: true,
};
const rentalOffer: AcquisitionOfferWorkspaceSummary = {
  ...purchaseOffer,
  id: "offer-review-rental",
  route: "rental-arbitrage",
  headlineTerms: { route: "rental-arbitrage", proposedMonthlyRent: { amount: 3400, currency: "USD" }, leaseTermMonths: 18, proposedCommencementDate: new Date("2026-09-01T00:00:00.000Z"), operatingPermissionRequested: true },
};
const aligned: AcquisitionAlignmentWorkspaceSummary = { status: "aligned", differences: [] };
const submitAction: AcquisitionWorkspaceNextAction = {
  id: "submit-offer",
  type: "submit-offer",
  label: "Submit offer",
  description: "Submit the current draft offer.",
  enabled: true,
  priority: "primary",
  command: {
    commandType: "submit-offer",
    opportunityId: "opportunity-offer-review",
    pipelineId: "pipeline-offer-review",
    expectedOpportunityVersion: 4,
    expectedPipelineVersion: 7,
  },
  blockers: [],
};

describe("OfferReviewWorkspace", () => {
  it("renders a purchase-specific review and unambiguous readiness", () => {
    const html = renderToStaticMarkup(<OfferReviewWorkspace offer={purchaseOffer} analysis={analysis} alignment={aligned} action={submitAction} />);
    for (const text of ["Review &amp; submit offer", "$415,000", "Cash purchase", "Earnest money", "Investment alignment", "Commercial drift", "Commercial", "Investment", "Workflow", "Technical", "Ready to submit", "Review confirmation"]) expect(html).toContain(text);
    expect(html).toContain("Pipeline version 7 will be validated by the server.");
  });

  it("renders a dedicated rental-arbitrage review", () => {
    const html = renderToStaticMarkup(<OfferReviewWorkspace offer={rentalOffer} analysis={{ ...analysis, route: "rental-arbitrage" }} alignment={aligned} action={submitAction} />);
    for (const text of ["$3,400/mo", "18-month rental-arbitrage lease", "Monthly rent", "Security deposit", "Commencement", "Operating permission"]) expect(html).toContain(text);
    expect(html).not.toContain("Earnest money");
  });

  it("separates projected warnings from unavailable submission infrastructure", () => {
    const checks = buildOfferReviewChecks({
      offer: { ...purchaseOffer, expiresAt: undefined },
      analysis: { ...analysis, stale: true, age: { days: 90, classification: "stale" } },
      alignment: { status: "changed", differences: ["Price drifted."] },
      action: { ...submitAction, enabled: false, blockers: [{ code: "REMOTE_INFRASTRUCTURE_NOT_VERIFIED", message: "Required infrastructure is not verified." }] },
    });
    expect(checks.filter(check => check.status === "warning").map(check => check.id)).toEqual(["commercial-expiration", "investment-current", "investment-alignment"]);
    expect(checks.find(check => check.id.startsWith("action-"))?.status).toBe("unavailable");
  });

  it("blocks review when the offer is no longer the editable current draft", () => {
    const checks = buildOfferReviewChecks({ offer: { ...purchaseOffer, status: "submitted", editable: false }, analysis, alignment: aligned, action: submitAction });
    expect(checks.filter(check => check.status === "blocked").map(check => check.id)).toEqual(["workflow-draft", "workflow-editable"]);
  });

  it("renders an explicit accessible confirmation rather than a browser confirm", () => {
    const html = renderToStaticMarkup(<SubmissionConfirmationDialog offer={purchaseOffer} confirmed={false} setConfirmed={vi.fn()} pending={false} phase="idle" onCancel={vi.fn()} onSubmit={vi.fn()} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("After successful submission, this offer becomes immutable");
    expect(html).toContain("Submit offer");
  });
});
