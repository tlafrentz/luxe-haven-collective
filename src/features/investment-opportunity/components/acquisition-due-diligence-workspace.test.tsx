import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createActionId } from "@/platform/actions";
import { createEvidenceId } from "@/platform/evidence";
import {
  createAcquisitionActorReference,
  createAcquisitionContingencyId,
  createAcquisitionPipelineId,
  createDueDiligenceItemId,
} from "../acquisition-pipeline";
import {
  buildRequirementsSummary,
  type AcquisitionWorkspaceNextAction,
  type AcquisitionWorkspacePipelineSource,
  type InvestmentAnalysisWorkspaceSummary,
  type InvestmentOpportunityWorkspaceSummary,
} from "../acquisition-workspace";
import {
  AcquisitionDueDiligenceWorkspace,
  diligenceHealth,
} from "./acquisition-due-diligence-workspace";

vi.mock("@/app/actions/acquisition-workspace-commands", () => ({
  activateAcquisitionPipelineAction: vi.fn(),
  beginClosingPreparationAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const at = new Date("2026-07-25T12:00:00.000Z");
const actor = createAcquisitionActorReference({ type: "user", id: "owner-diligence" });
const pipelineId = createAcquisitionPipelineId("acquisition-pipeline-diligence");
const contingencyId = createAcquisitionContingencyId("acquisition-contingency-inspection");
const diligenceId = createDueDiligenceItemId("due-diligence-item-inspection");
const contingency: AcquisitionWorkspacePipelineSource["contingencies"][number] = {
  requirementType: "contingency",
  id: contingencyId,
  pipelineId,
  route: "purchase",
  type: "inspection",
  title: "Inspection contingency",
  description: "Resolve material property-condition findings.",
  status: "failed",
  blocking: true,
  priority: "critical",
  dueAt: new Date("2026-07-20T00:00:00.000Z"),
  source: { type: "operator-added", explanation: "Required" },
  relatedDueDiligenceItemIds: [diligenceId],
  actionReferences: [{ actionId: createActionId("action-inspection"), relationship: "executes-requirement" }],
  evidenceReferences: [{ evidenceId: createEvidenceId("evidence-inspection"), relationship: "supports" }],
  documentReferences: [{ documentId: "document-inspection", relationship: "inspection" }],
  outcome: {
    status: "failed",
    explanation: "Roof condition unresolved.",
    concerns: [{
      title: "Roof replacement",
      summary: "Inspection indicates material roof replacement exposure.",
      severity: "high",
      blocking: true,
      evidenceReferences: [{ evidenceId: createEvidenceId("evidence-inspection"), relationship: "supports" }],
    }],
    recordedAt: at,
    recordedBy: actor,
  },
  createdAt: at,
  createdBy: actor,
  updatedAt: at,
};
const diligence: AcquisitionWorkspacePipelineSource["dueDiligenceItems"][number] = {
  requirementType: "due-diligence",
  id: diligenceId,
  pipelineId,
  route: "purchase",
  category: "property-condition",
  title: "Property inspection",
  description: "Review the physical condition assessment.",
  status: "satisfied",
  blocking: false,
  priority: "high",
  relatedContingencyId: contingencyId,
  actionReferences: [],
  evidenceReferences: [{ evidenceId: createEvidenceId("evidence-report"), relationship: "supports" }],
  documentReferences: [],
  outcome: { status: "satisfied", explanation: "Inspection completed.", recordedAt: at, recordedBy: actor },
  createdAt: at,
  createdBy: actor,
  updatedAt: at,
};
const pipeline = {
  contingencies: [contingency],
  dueDiligenceItems: [diligence],
} as Pick<AcquisitionWorkspacePipelineSource, "contingencies" | "dueDiligenceItems"> as AcquisitionWorkspacePipelineSource;
const requirements = buildRequirementsSummary(
  pipeline,
  [{ actionId: "action-inspection", status: "blocked", blocked: true, updatedAt: at }],
  [
    { evidenceId: "evidence-inspection", available: false, state: "withdrawn", updatedAt: at },
    { evidenceId: "evidence-report", available: true, state: "available", updatedAt: at },
  ],
  at,
  8,
);
const opportunity: InvestmentOpportunityWorkspaceSummary = {
  id: "opportunity-diligence",
  name: "Mesa Retreat",
  location: { address1: "1 Main", city: "Mesa", state: "AZ", postalCode: "85201", display: "Mesa, AZ" },
  route: "purchase",
  status: "under-contract",
  archived: false,
  tags: [],
  createdAt: at,
  updatedAt: at,
};
const analysis: InvestmentAnalysisWorkspaceSummary = {
  analysisId: "analysis-diligence",
  version: 2,
  analyzedAt: at,
  route: "purchase",
  recommendation: "buy-with-conditions",
  age: { days: 1, classification: "current" },
  stale: false,
  historicalAnalysisHref: "/analysis",
};
const action: AcquisitionWorkspaceNextAction = {
  id: "manage-due-diligence",
  type: "manage-due-diligence",
  label: "Review inspection findings",
  description: "Resolve priority acquisition requirements.",
  enabled: false,
  priority: "primary",
  command: { commandType: "manage-requirements", opportunityId: opportunity.id, pipelineId: pipelineId.value, expectedOpportunityVersion: 2, expectedPipelineVersion: 4 },
  blockers: [{ code: "REMOTE_NOT_VERIFIED", message: "Required infrastructure is not verified." }],
};

describe("AcquisitionDueDiligenceWorkspace", () => {
  it("renders readiness, objective, blockers, distinct requirement groups, evidence, risks, relationships, and recent changes", () => {
    const html = renderToStaticMarkup(<AcquisitionDueDiligenceWorkspace requirements={requirements} readiness={null} primaryAction={action} opportunity={opportunity} analysis={analysis} />);
    for (const text of ["Current readiness", "Current diligence objective", "Review inspection findings", "Critical blockers", "Contingencies", "Due diligence tasks", "Evidence", "Acquisition risks", "Requirement relationships", "Warnings", "Recent requirement changes"]) expect(html).toContain(text);
    expect(html).toContain("Inspection contingency");
    expect(html).toContain("Property inspection");
    expect(html).toContain("Roof replacement");
    expect(html).toContain("1 available");
    expect(html).toContain("1 withdrawn");
    expect(html).toContain("Related Diligence");
    expect(html).toContain("<details");
  });

  it("derives failed health and completion counts from canonical requirement states", () => {
    expect(diligenceHealth(requirements)).toBe("failed");
    expect(requirements.totals).toMatchObject({ contingencies: 1, dueDiligence: 1, satisfied: 1, failed: 1 });
    expect(requirements.evidence).toEqual({ linked: 2, available: 1, unavailable: 1, withdrawn: 1, superseded: 0 });
  });

  it("renders intentional no-requirement state", () => {
    const empty = buildRequirementsSummary({ ...pipeline, contingencies: [], dueDiligenceItems: [] }, [], [], at, 8);
    const html = renderToStaticMarkup(<AcquisitionDueDiligenceWorkspace requirements={empty} readiness={null} primaryAction={action} opportunity={opportunity} analysis={analysis} />);
    expect(html).toContain("Requirements have not yet been initialized");
    expect(html).not.toContain("Acquisition risks");
  });

  it("does not expose evidence content or fabricate document metadata", () => {
    const html = renderToStaticMarkup(<AcquisitionDueDiligenceWorkspace requirements={requirements} readiness={null} primaryAction={action} opportunity={opportunity} analysis={analysis} />);
    expect(html).toContain("Evidence content, provenance, URLs, and document previews are intentionally excluded");
    expect(html).not.toContain("Roof inspection PDF");
  });
});
