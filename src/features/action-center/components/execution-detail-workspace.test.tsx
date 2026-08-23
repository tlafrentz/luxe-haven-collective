import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ExecuteActionDetail } from "@/platform/actions";
import { ExecutionDetailWorkspace } from "./execution-detail-workspace";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/execute-controls", () => ({ attachExecuteEvidenceAction: vi.fn(), blockExecuteAction: vi.fn(), resolveExecuteBlockerAction: vi.fn(), reviewExecuteEvidenceAction: vi.fn(), submitExecuteEvidenceAction: vi.fn(), transitionExecuteAction: vi.fn() }));

const detail: ExecuteActionDetail = {
  id: "action-1", version: 3, title: "Update weekday pricing", status: "in-progress", priority: "high",
  owner: { type: "user", id: "owner-1" }, assignee: { type: "user", id: "operator-1" }, propertyId: "property-1",
  planId: "plan-1", decisionId: "decision-1", deadline: new Date("2026-09-01T17:00:00Z"), expectedOutcome: "Improve weekday revenue",
  successMetric: "Weekday RevPAR", completionChecklist: ["Pricing rules saved"], evidencePolicy: { mode: "specific", requiredTypes: ["text-note"], reviewRequired: true },
  evidence: [{ id: "evidence-1", workspaceId: "workspace-1", actionId: "action-1", type: "text-note", status: "submitted", caption: "Pricing updated", createdBy: "operator-1", createdAt: new Date("2026-08-23T12:00:00Z") }],
  dependencies: [{ workspaceId: "workspace-1", actionId: "action-1", dependsOnActionId: "action-0", createdById: "owner-1", createdAt: new Date("2026-08-22T12:00:00Z") }],
  dependentActions: [], unresolvedDependencyIds: ["action-0"], activeBlockers: [], resolvedBlockers: [], reviewState: "preparing",
  measurementPreparation: { required: true, expectedOutcome: "Improve weekday revenue", successMetric: "Weekday RevPAR" }, activity: [],
  validCommands: ["add-evidence", "submit-evidence", "submit-for-review"],
};

describe("PS-001C canonical customer action detail", () => {
  it("shows lineage, evidence, dependencies, and only projected commands", () => {
    const html = renderToStaticMarkup(<ExecutionDetailWorkspace detail={detail} />);
    expect(html).toContain("View Action Plan");
    expect(html).toContain("View source decision");
    expect(html).toContain("Pricing updated");
    expect(html).toContain("action-0 · Incomplete");
    expect(html).toContain("Submit for review");
    expect(html).not.toContain(">Complete<");
    expect(html).not.toContain(">Retry<");
  });
});
