import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AutomationWorkspaceProjection } from "../application";
import {
  ApprovalDetailView,
  AutomationFailure,
  AutomationOverviewView,
  RunDetailView,
} from "./automation-workspace";

const command = {
  type: "reconcile" as const,
  label: "Reconcile outcome",
  consequence: "Queries the owning capability.",
  targetId: "run-1",
  expectedVersion: 2,
  confirmationRequired: true,
  reason: { required: false, minimumLength: 0, maximumLength: 500 },
  createsApproval: false,
  idempotencyRequired: true,
};
const run = {
  id: "run-1",
  automationId: "automation-1",
  definitionVersion: 1,
  status: "reconciliation_required" as const,
  propertyIds: ["property-1"],
  updatedAt: "2026-08-10T12:00:00Z",
  progress: { complete: 0, total: 1 },
  outcome: "Outcome must be reconciled",
  attention: "uncertain" as const,
  href: "/dashboard/automations/runs/run-1",
  validCommands: [command],
};
const approval = {
  id: "approval-1",
  runId: "run-1",
  status: "pending" as const,
  requestedAt: "2026-08-10T12:00:00Z",
  expiresAt: "2026-08-11T12:00:00Z",
  automationId: "automation-1",
  consequence: "This does not approve the business decision.",
  href: "/dashboard/automations/approvals/approval-1",
  validCommands: [],
};
const model = {
  projectionVersion: "au001d-workspace.v1",
  generatedAt: "2026-08-10T12:00:00Z",
  freshness: "partial",
  scope: {
    tenantId: "tenant-1",
    propertyIds: ["property-1"],
    label: "Oak Street",
    timeZone: "America/Chicago",
  },
  notices: [{ classification: "partial", message: "Run history is partial." }],
  counts: {
    active: 1,
    paused: 0,
    draft: 0,
    attention: 1,
    approvals: 1,
    running: 0,
    failed: 0,
    reconciliation: 1,
  },
  automations: [],
  approvals: [approval],
  runs: [run],
  templates: [],
} as AutomationWorkspaceProjection;
const flags = {
  workspace: true,
  readOnly: false,
  authoring: true,
  approvals: true,
  runControls: true,
  templates: true,
};
describe("AU-001D accessible experience", () => {
  it("renders counts and uncertainty without treating completion as outcome success", () => {
    const html = renderToStaticMarkup(<AutomationOverviewView model={model} />);
    expect(html).toContain("Needs attention");
    expect(html).toContain("Outcome must be reconciled");
    expect(html).not.toContain("Business outcome achieved");
  });
  it("explains blind-retry prevention and renders only projected commands", () => {
    const html = renderToStaticMarkup(
      <RunDetailView item={run} flags={flags} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Blind retry is disabled");
    expect(html).toContain("Reconcile outcome");
    expect(html).not.toContain("Retry now");
  });
  it("distinguishes automation approval from the underlying business decision", () => {
    const html = renderToStaticMarkup(
      <ApprovalDetailView item={approval} flags={flags} />,
    );
    expect(html).toContain("does not approve the business decision");
  });
  it("renders safe failures with a correlation reference", () => {
    const html = renderToStaticMarkup(
      <AutomationFailure
        code="AUTOMATION_PROJECTION_UNAVAILABLE"
        message="Projection unavailable."
        correlationId="correlation-1"
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("correlation-1");
    expect(html).not.toContain("stack");
  });
});
