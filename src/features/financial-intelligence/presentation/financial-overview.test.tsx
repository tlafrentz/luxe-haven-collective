import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Money } from "@/platform/kernel";
import type { FinancialOverview } from "../application";
import { FinancialOverviewEmpty, FinancialOverviewErrorView, FinancialOverviewSkeleton, FinancialOverviewView } from "./financial-overview";

const overview = {
  identity: { workspaceId: "w", organizationId: "o", reportingCurrency: "USD", fiscalYearStartMonth: 1, timezone: "UTC", reportingStandards: ["GAAP"], accountingMethod: "accrual" },
  scope: { type: "workspace", label: "Full Workspace", propertyIds: ["one"], propertyCount: 1 },
  period: { kind: "month", from: "2026-07-01", to: "2026-07-31", reportingCalendar: "fiscal" },
  accountingBasis: "accrual", reportingCurrency: "USD",
  condition: { status: "stable", summary: "No material condition dominates.", positiveDrivers: ["Positive NOI."], limitingConditions: [], confidence: "high", evidenceIds: ["e"], policyVersion: "v1" },
  metrics: [{ metric: "revenue", current: { money: Money.usd(100), qualification: "measured" }, availability: "available", confidence: "high", freshness: "current", evidenceIds: ["e"] }],
  profitability: { status: "profitable", noi: { money: Money.usd(60), qualification: "measured" }, margin: { percentage: .6, qualification: "measured" }, explanation: "Profitable.", confidence: "high" },
  liquidity: { status: "insufficient-evidence", cash: { qualification: "unavailable", limitation: "Missing cash." }, movement: { qualification: "unavailable" }, reserveTargetConfigured: false, explanation: "Cash unavailable.", confidence: "insufficient-evidence" },
  changes: [], drivers: { revenue: [], expenses: [] }, propertyContribution: [], obligations: { sourceAvailable: false, items: [] },
  planning: { available: false, status: "unavailable", lines: [], explanation: "No approved budget." }, attention: [],
  execution: { activeDecisions: 0, openActions: 0, items: [] },
  evidence: { revenueCoverage: 1, expenseCoverage: 1, cashCoverage: 0, propertyCoverage: 1, accountCoverage: 1, categorizationCoverage: 1, reconciliation: "unknown", historyMonths: 12, gaps: [] },
  confidence: "high", freshness: "current", evaluatedAt: "2026-07-25T12:00:00Z", projectionVersion: "v1", state: "partial", permissionLimited: false,
} satisfies FinancialOverview;

describe("Financial Overview presentation states", () => {
  it.each(["strong", "stable", "attention-needed", "at-risk", "insufficient-evidence"] as const)("renders the %s condition with semantic headings", status => {
    const html = renderToStaticMarkup(<FinancialOverviewView overview={{ ...overview, condition: { ...overview.condition, status } }} />);
    expect(html).toContain("Financial condition");
    expect(html).toContain(status.split("-").map(part => part[0]!.toUpperCase() + part.slice(1)).join(" "));
    expect(html).toContain("Accounting basis");
  });
  it("renders unavailable values, permission and evidence context without hidden totals", () => {
    const html = renderToStaticMarkup(<FinancialOverviewView overview={{ ...overview, permissionLimited: true, state: "permission-limited" }} />);
    expect(html).toContain("Cash unavailable");
    expect(html).toContain("Financial Summary");
    expect(html).toContain("Evidence &amp; freshness");
  });
  it("renders loading, empty, and typed error states accessibly", () => {
    expect(renderToStaticMarkup(<FinancialOverviewSkeleton />)).toContain('aria-busy="true"');
    expect(renderToStaticMarkup(<FinancialOverviewEmpty />)).toContain("Financial data unavailable");
    expect(renderToStaticMarkup(<FinancialOverviewErrorView code="currency" message="Mismatch" />)).toContain('role="alert"');
  });
  it("uses responsive grids without desktop-only tables or horizontal overflow", () => {
    const html = renderToStaticMarkup(<FinancialOverviewView overview={overview} />);
    expect(html).toMatch(/sm:grid-cols-2/);
    expect(html).toMatch(/xl:grid-cols-6/);
    expect(html).not.toContain("<table");
  });
});
