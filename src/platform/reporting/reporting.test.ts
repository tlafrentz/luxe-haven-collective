import { describe, expect, it } from "vitest";
import {
  assertSharingAllowed,
  createGeneratedReport,
  evaluateShareAccess,
  generateReportNumber,
  getReportDefinition,
  renderReportHtml,
  renderSimpleReportPdf,
  reportDefinitions,
  transitionReportStatus,
  validateReportProjection,
  validateReportRequest,
  type ReportProjection,
  type ReportRequest,
  type ReportTemplate,
} from "./index";

const now = "2026-07-25T12:00:00.000Z";
const template: ReportTemplate = Object.freeze({
  id: "report-template-investment-decision-v1", key: "investment-decision", name: "Investment Decision",
  reportType: "investment-decision", version: 1, status: "active",
  sectionKeys: Object.freeze(["decision-summary","property-profile","market-intelligence","financial-performance","risk-analysis","investment-score","recommendation","evidence-methodology"]),
  brand: Object.freeze({ name: "Luxe Haven", accent: "#8a6b22", confidentiality: "Confidential" }),
  createdAt: now, activatedAt: now,
});
const request: ReportRequest = Object.freeze({
  id: "request-1", workspaceId: "workspace-1", requestedByProfileId: "profile-1", reportType: "investment-decision",
  scope: Object.freeze({ type: "investment-scenario", workspaceId: "workspace-1", opportunityId: "opportunity-1", scenarioId: "scenario-1", label: "650 S Main", partial: false }),
  sourceContext: Object.freeze({ type: "investment-scenario", opportunityId: "opportunity-1", scenarioId: "scenario-1" }),
  templateId: template.id, sectionConfiguration: Object.freeze([]), status: "queued", idempotencyKey: "request-key", createdAt: now,
});
const projection: ReportProjection = Object.freeze({
  reportType: "investment-decision", scope: request.scope, title: "Investment Decision — 650 S Main",
  summary: "Proceed with conditions based on the selected immutable scenario.",
  sections: Object.freeze(template.sectionKeys.map((key, order) => Object.freeze({
    key, title: key.replaceAll("-", " "), order, status: "included" as const,
    metrics: Object.freeze(key === "financial-performance" ? [Object.freeze({ key: "cash-flow", label: "Annual Cash Flow", displayValue: "$18,400", rawValue: 18400, unit: "USD", qualification: "projected" as const, accessibleDescription: "Projected annual cash flow of 18,400 US dollars." })] : []),
    confidence: "moderate" as const, freshness: "current" as const, evidence: Object.freeze([]),
  }))),
  evidence: Object.freeze([]), confidence: "moderate", freshness: "current",
  sourceVersions: Object.freeze([{ source: "investment-scenario", version: "scenario.v3", evaluatedAt: now }]),
  projectionVersion: "investment-report.v1", evaluatedAt: now,
});

describe("Platform Reporting", () => {
  it("defines all four initial report types and enforces scope, entitlement, and required sections", () => {
    expect(reportDefinitions).toHaveLength(4);
    expect(validateReportRequest({ request, template, authorizedWorkspaceId: "workspace-1", hasEntitlement: true }).definition.key).toBe("investment-decision");
    expect(() => validateReportRequest({ request, template, authorizedWorkspaceId: "workspace-2", hasEntitlement: true })).toThrow("not authorized");
    expect(() => validateReportRequest({ request, template, authorizedWorkspaceId: "workspace-1", hasEntitlement: false })).toThrow("investment.reports.generate");
  });

  it("creates an immutable, reproducible snapshot with stable numbering", () => {
    const definition = getReportDefinition("investment-decision");
    expect(definition).not.toBeNull();
    validateReportProjection(projection, definition!);
    const report = createGeneratedReport({ id: "report-1", reportNumber: generateReportNumber("investment-decision", 142, 2026), request, projection, template, versionNumber: 1, seriesKey: "opportunity-1", generatedAt: now });
    expect(report.reportNumber).toBe("INV-2026-000142");
    expect(Object.isFrozen(report.projectionSnapshot.sections)).toBe(true);
    expect(() => { (report.projectionSnapshot as { title: string }).title = "Changed"; }).toThrow();
  });

  it("enforces lifecycle and secure-sharing boundaries", () => {
    expect(transitionReportStatus("generated", "archived")).toBe("archived");
    expect(() => transitionReportStatus("archived", "queued")).toThrow("cannot transition");
    expect(evaluateShareAccess({ id: "s", reportId: "r", createdByProfileId: "p", status: "active", accessMode: "view", maxViews: 2, viewCount: 1, createdAt: now }).canDownload).toBe(false);
    expect(() => assertSharingAllowed("financial-performance", true)).toThrow("not allowed");
  });

  it("renders semantic qualification and accessible report HTML without recalculation", async () => {
    const rendered = await renderReportHtml(projection, template);
    expect(rendered.content).toContain("<h1>Investment Decision");
    expect(rendered.content).toContain("projected. Projected annual cash flow");
    expect(rendered.content).not.toContain("<th scope=\"col\">");
    expect(rendered.sizeBytes).toBeGreaterThan(500);
    const pdf = renderSimpleReportPdf(rendered.content, { title: projection.title, generatedAt: now });
    expect(new TextDecoder().decode(pdf.slice(0, 8))).toBe("%PDF-1.4");
    expect(pdf.byteLength).toBeGreaterThan(500);
  });
});
