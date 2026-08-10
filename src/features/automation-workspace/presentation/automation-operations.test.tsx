import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AutomationOperationsProjection } from "@/platform/automations";
import { AutomationOperationsView } from "./automation-operations";

const model: AutomationOperationsProjection = {
  projectionVersion: "au001e-operations.v1",
  generatedAt: "2026-08-10T18:00:00Z",
  scope: {
    tenantId: "tenant",
    type: "property",
    propertyIds: ["property"],
    from: "2026-08-01T00:00:00Z",
    to: "2026-08-10T18:00:00Z",
    timeZone: "America/Chicago",
    label: "Oak Street",
  },
  freshness: {
    status: "partial",
    generatedAt: "2026-08-10T18:00:00Z",
    staleAfterMs: 300000,
    missingSources: ["execute"],
    restrictedRecordCount: 1,
  },
  overallHealth: "degraded",
  components: [
    {
      id: "command-adapters",
      name: "Command adapters",
      critical: true,
      status: "degraded",
      evaluatedAt: "2026-08-10T18:00:00Z",
      policyVersion: "v1",
      measures: {},
      thresholds: {},
      reasons: ["Execute is unavailable."],
      freshness: "partial",
      restrictions: [],
      investigationHref: "/dashboard/automations/operations",
    },
  ],
  queues: [
    {
      id: "reconciliation",
      label: "Uncertain outcomes",
      count: 1,
      oldestAgeMs: 60000,
      p50AgeMs: 60000,
      p95AgeMs: 60000,
      arrivalRatePerHour: null,
      completionRatePerHour: null,
      capacity: "available",
      status: "healthy",
      thresholdMs: 900000,
    },
  ],
  serviceLevels: [],
  incidents: [],
  integrations: [
    {
      id: "execute",
      owningCapability: "Execute",
      direction: "outbound",
      required: true,
      configured: false,
      enabled: true,
      expectedVersions: ["v1"],
      compatibility: "unknown",
      status: "unhealthy",
      degradation: "Preserve queued work.",
      runbook: "runbook",
    },
  ],
  reconciliation: {
    candidateCount: 1,
    humanReviewCount: 1,
    candidates: [
      {
        id: "candidate",
        type: "unknown-outcome",
        runId: "run",
        stepId: "step",
        detectedAt: "2026-08-10T18:00:00Z",
        reason: "Owning result is unknown.",
        safeRecovery: "reconcile",
        requiresHumanReview: true,
        expectedVersion: 2,
      },
    ],
  },
  validCommands: [],
  restrictions: [
    {
      code: "AUTHORIZED_SUBSET",
      message: "One inaccessible record was excluded before aggregation.",
    },
  ],
};
describe("AU-001E operational experience", () => {
  it("labels degraded, restricted, and unknown outcome states without exposing unsafe retry", () => {
    const html = renderToStaticMarkup(
      <AutomationOperationsView model={model} reportsEnabled exportsEnabled />,
    );
    expect(html).toContain("Operational health");
    expect(html).toContain("AUTHORIZED SUBSET");
    expect(html).toContain("Blind command replay is prohibited");
    expect(html).toContain("Human review");
    expect(html).not.toContain("Retry command");
  });
  it("renders all eight governed report definitions", () => {
    const html = renderToStaticMarkup(
      <AutomationOperationsView model={model} reportsEnabled exportsEnabled />,
    );
    expect(html.match(/Open report/g) ?? []).toHaveLength(8);
    expect(html).toContain("Automation Reliability");
  });
});
