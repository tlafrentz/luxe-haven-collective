import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  AcquisitionCommercialWorkspaceSummary,
  AcquisitionOfferHeadlineTerms,
  AcquisitionWorkspaceNextAction,
  InvestmentAnalysisWorkspaceSummary,
  InvestmentOpportunityWorkspaceSummary,
} from "../acquisition-workspace";
import {
  AcquisitionCommercialWorkspace,
  buildCommercialDeltas,
  buildCommercialTimeline,
} from "./acquisition-commercial-workspace";

vi.mock("@/app/actions/acquisition-workspace-commands", () => ({
  activateAcquisitionPipelineAction: vi.fn(),
  beginClosingPreparationAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const at = new Date("2026-07-25T12:00:00.000Z");
const purchase: AcquisitionOfferHeadlineTerms = {
  route: "purchase",
  offerPrice: { amount: 410_000, currency: "USD" },
  financingType: "financed",
  proposedClosingDate: new Date("2026-08-20T00:00:00.000Z"),
};
const purchaseCounter: AcquisitionOfferHeadlineTerms = {
  route: "purchase",
  offerPrice: { amount: 420_000, currency: "USD" },
  financingType: "cash",
  proposedClosingDate: new Date("2026-08-25T00:00:00.000Z"),
};
const emptyCommercial: AcquisitionCommercialWorkspaceSummary = {
  currentOffer: null,
  priorOffers: [],
  priorOfferTotalCount: 0,
  priorOffersTruncated: false,
  latestResponse: null,
  acceptedAgreement: null,
  contract: null,
  analysisAlignment: null,
  contractAlignment: null,
};
const commercial: AcquisitionCommercialWorkspaceSummary = {
  ...emptyCommercial,
  currentOffer: {
    id: "offer-current",
    sequence: 2,
    status: "submitted",
    route: "purchase",
    createdAt: new Date("2026-07-20T12:00:00.000Z"),
    submittedAt: new Date("2026-07-21T12:00:00.000Z"),
    expiresAt: new Date("2026-07-28T12:00:00.000Z"),
    sourceAnalysis: { analysisId: "analysis-commercial", version: 4, analyzedAt: new Date("2026-07-19T12:00:00.000Z") },
    headlineTerms: purchase,
    current: true,
    editable: false,
  },
  priorOffers: [{ id: "offer-prior", sequence: 1, status: "superseded", createdAt: new Date("2026-07-18T12:00:00.000Z"), submittedAt: new Date("2026-07-19T12:00:00.000Z") }],
  priorOfferTotalCount: 1,
  latestResponse: {
    id: "response-counter",
    type: "countered",
    offerId: "offer-current",
    respondedAt: at,
    counterpartyType: "seller",
    headlineTerms: purchaseCounter,
    explanation: "Seller requested revised economics.",
  },
  analysisAlignment: { status: "changed", differences: ["Purchase price exceeds the analyzed offer basis."] },
};
const opportunity: InvestmentOpportunityWorkspaceSummary = {
  id: "opportunity-commercial",
  name: "Mesa Downtown Retreat",
  location: { address1: "1 Main", city: "Mesa", state: "AZ", postalCode: "85201", display: "Mesa, AZ" },
  route: "purchase",
  status: "offer-submitted",
  archived: false,
  tags: [],
  createdAt: at,
  updatedAt: at,
};
const analysis: InvestmentAnalysisWorkspaceSummary = {
  analysisId: "analysis-commercial",
  version: 4,
  analyzedAt: new Date("2026-07-19T12:00:00.000Z"),
  route: "purchase",
  recommendation: "buy",
  age: { days: 6, classification: "current" },
  stale: false,
  historicalAnalysisHref: "/analysis",
};
const action: AcquisitionWorkspaceNextAction = {
  id: "record-response",
  type: "record-response",
  label: "Review counter",
  description: "Evaluate and record the negotiation response.",
  enabled: false,
  priority: "primary",
  command: {
    commandType: "record-response",
    opportunityId: opportunity.id,
    pipelineId: "pipeline-commercial",
    expectedOpportunityVersion: 2,
    expectedPipelineVersion: 5,
  },
  blockers: [{ code: "REMOTE_NOT_VERIFIED", message: "Required infrastructure is not verified." }],
};

describe("AcquisitionCommercialWorkspace", () => {
  it("renders the professional negotiation hierarchy and changed alignment", () => {
    const html = renderToStaticMarkup(<AcquisitionCommercialWorkspace commercial={commercial} opportunity={opportunity} analysis={analysis} primaryAction={action} />);
    for (const heading of ["Current position", "Current offer #2", "Investment alignment", "Negotiation timeline", "Counteroffer comparison", "Counteroffer changes", "Agreement status", "Offer history", "Commercial guidance", "Recommended next action"]) expect(html).toContain(heading);
    expect(html).toContain("Purchase price exceeds the analyzed offer basis.");
    expect(html).toContain("Offer #2 → Analysis version 4");
    expect(html).toContain('role="table"');
  });

  it("renders an intentional no-offer state", () => {
    const html = renderToStaticMarkup(<AcquisitionCommercialWorkspace commercial={emptyCommercial} opportunity={opportunity} analysis={analysis} primaryAction={action} />);
    expect(html).toContain("No offer has been prepared");
    expect(html).toContain("Create the first offer");
    expect(html).not.toContain("Counteroffer comparison");
  });

  it("keeps accepted agreement visually distinct from contract execution", () => {
    const accepted: AcquisitionCommercialWorkspaceSummary = {
      ...commercial,
      latestResponse: { ...commercial.latestResponse!, type: "accepted", headlineTerms: undefined },
      acceptedAgreement: { source: "counteroffer", acceptedAt: at, offerId: "offer-current", responseId: "response-counter", externalReferencePresent: false, headlineTerms: purchaseCounter },
      contract: null,
    };
    const html = renderToStaticMarkup(<AcquisitionCommercialWorkspace commercial={accepted} opportunity={opportunity} analysis={analysis} primaryAction={action} />);
    expect(html).toContain("Accepted Jul 25, 2026");
    expect(html).toContain("Waiting on");
    expect(html).toContain("Contract execution");
    expect(html).not.toContain("Executed contract");
  });
});

describe("commercial presentation projections", () => {
  it("projects only changed purchase headline terms", () => {
    expect(buildCommercialDeltas(purchase, purchaseCounter)).toEqual([
      { label: "Offer price", delta: "+$10,000" },
      { label: "Proposed closing", delta: "+5 days" },
      { label: "Financing", delta: "Financed → Cash" },
    ]);
  });

  it("projects route-specific rental deltas", () => {
    const current: AcquisitionOfferHeadlineTerms = { route: "rental-arbitrage", proposedMonthlyRent: { amount: 3400, currency: "USD" }, leaseTermMonths: 12, operatingPermissionRequested: true };
    const counter: AcquisitionOfferHeadlineTerms = { route: "rental-arbitrage", proposedMonthlyRent: { amount: 3550, currency: "USD" }, leaseTermMonths: 18, operatingPermissionRequested: false };
    expect(buildCommercialDeltas(current, counter)).toEqual([
      { label: "Monthly rent", delta: "+$150/month" },
      { label: "Lease term", delta: "+6 months" },
      { label: "Operating permission", delta: "No longer requested" },
    ]);
  });

  it("orders negotiation history chronologically with stable commercial lineage", () => {
    const events = buildCommercialTimeline(commercial);
    expect(events.map(event => event.label)).toEqual([
      "Offer #1 Superseded",
      "Offer #2 drafted",
      "Offer #2 submitted",
      "Counterparty countered",
    ]);
    expect(events.every((event, index) => index === 0 || event.occurredAt >= events[index - 1]!.occurredAt)).toBe(true);
  });
});
