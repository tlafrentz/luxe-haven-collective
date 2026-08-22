import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Money } from "@/platform/kernel";
import type { FinancialOverview } from "../application";
import {
  buildExpenseDetailCsv, buildFinancialSummaryCsv, csvEscape,
  FinancialOverviewEmpty, FinancialOverviewErrorView, FinancialOverviewSkeleton, FinancialOverviewView,
} from "./financial-overview";

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
  evidence: { revenueCoverage: 1, expenseCoverage: 1, cashCoverage: 0, propertyCoverage: 1, accountCoverage: 1, categorizationCoverage: 1, uncategorizedTransactionCount: 0, reconciliation: "unknown", historyMonths: 12, gaps: [] },
  performanceTrend: [],
  confidence: "high", freshness: "current", evaluatedAt: "2026-07-25T12:00:00Z", projectionVersion: "v1", state: "partial", permissionLimited: false,
} satisfies FinancialOverview;

describe("Financial Overview presentation states", () => {
  it.each(["strong", "stable", "attention-needed", "at-risk", "insufficient-evidence"] as const)("renders the %s overview without inventing attention", status => {
    const html = renderToStaticMarkup(<FinancialOverviewView overview={{ ...overview, condition: { ...overview.condition, status } }} />);
    expect(html).toContain("Financial Overview");
    expect(html).toContain("Operating Expenses");
    expect(html).not.toContain("No material financial attention conditions");
  });
  it("renders unavailable values, permission and evidence context without hidden totals", () => {
    const html = renderToStaticMarkup(<FinancialOverviewView overview={{ ...overview, permissionLimited: true, state: "permission-limited" }} />);
    expect(html).not.toContain("Cash Balance");
    expect(html).toContain("Not available");
    expect(html).toContain("Financial Summary");
    expect(html).toContain("Projections, scenarios, and budgets are kept separate");
  });
  it("renders loading, empty, and typed error states accessibly", () => {
    expect(renderToStaticMarkup(<FinancialOverviewSkeleton />)).toContain('aria-busy="true"');
    expect(renderToStaticMarkup(<FinancialOverviewEmpty />)).toContain("Financial data unavailable");
    expect(renderToStaticMarkup(<FinancialOverviewErrorView code="currency" message="Mismatch" />)).toContain('role="alert"');
  });
  it("uses responsive summaries and links out to expense detail instead of embedding the full workspace", () => {
    const html = renderToStaticMarkup(<FinancialOverviewView overview={overview} />);
    expect(html).toMatch(/sm:grid-cols-2/);
    expect(html).toMatch(/lg:grid-cols-4/);
    expect(html).not.toContain("Cash Balance");
    expect(html).toContain("Expense composition");
    expect(html).toContain("View expense details");
    expect(html).not.toContain("Record expense");
  });
  it("renders favorability-aware comparison language for each KPI", () => {
    const rich: FinancialOverview = {
      ...overview,
      metrics: [
        { metric: "revenue", current: { money: Money.usd(2604), qualification: "measured" }, change: { amount: Money.usd(2003), percentageChange: 3.333, kind: "absolute-and-percentage", direction: "improved" }, availability: "available", confidence: "high", freshness: "current", evidenceIds: ["e"] },
        { metric: "operating-expenses", current: { money: Money.usd(1663), qualification: "measured" }, change: { amount: Money.usd(-515), percentageChange: -.236, kind: "absolute-and-percentage", direction: "improved" }, availability: "available", confidence: "high", freshness: "current", evidenceIds: ["e"] },
        { metric: "noi", current: { money: Money.usd(941), qualification: "measured" }, change: { amount: Money.usd(-420), percentageChange: -.182, kind: "absolute-and-percentage", direction: "declined" }, availability: "available", confidence: "high", freshness: "current", evidenceIds: ["e"] },
        { metric: "operating-margin", current: { percentage: .362, qualification: "measured" }, availability: "available", confidence: "high", freshness: "current", evidenceIds: ["e"] },
      ],
    };
    const html = renderToStaticMarkup(<FinancialOverviewView overview={rich} />);
    expect(html).toContain("+$2,003");
    expect(html).toContain("333.3% higher");
    expect(html).toContain("$515 lower");
    expect(html).toContain("23.6% improvement");
    expect(html).toContain("18.2% lower");
    expect(html).toContain("No comparison available");
    expect(html).toContain("The previous period has insufficient data");
  });
  it("shows a percentage-point margin change rather than an inflated relative percent", () => {
    const withMarginChange: FinancialOverview = {
      ...overview,
      metrics: [{ metric: "operating-margin", current: { percentage: .362, qualification: "measured" }, comparison: { percentage: .108, qualification: "measured" }, change: { kind: "absolute-only", direction: "improved", percentagePointChange: .254 }, availability: "available", confidence: "high", freshness: "current", evidenceIds: ["e"] }],
    };
    const html = renderToStaticMarkup(<FinancialOverviewView overview={withMarginChange} />);
    expect(html).toContain("+25.4 pts");
  });
  it("always renders the financial-attention section, including its all-clear state", () => {
    const html = renderToStaticMarkup(<FinancialOverviewView overview={{ ...overview, attention: [] }} />);
    expect(html).toContain("Financial data is current.");
    expect(html).toContain("No material data-quality issues were detected for this period.");
  });
  it("renders top expense categories with share and comparison, and links out rather than duplicating the expense workspace", () => {
    const withDrivers: FinancialOverview = {
      ...overview,
      drivers: { revenue: [], expenses: [
        { id: "cleaning", label: "Cleaning", amount: Money.usd(842), share: .386, change: Money.usd(-64), qualification: "measured", confidence: "high" },
        { id: "utilities", label: "Utilities", amount: Money.usd(342), share: .206, qualification: "measured", confidence: "high" },
      ] },
    };
    const html = renderToStaticMarkup(<FinancialOverviewView overview={withDrivers} />);
    expect(html).toContain("Cleaning");
    expect(html).toContain("38.6%");
    expect(html).toContain("$64");
    expect(html).toContain("lower");
    expect(html).toContain("Utilities");
    expect(html).toContain("No comparison available");
    expect(html).toContain("View expense details");
  });
  it("renders a financial-performance section with a comparison-period label, completeness, and last-refreshed timestamp", () => {
    const withComparisonPeriod: FinancialOverview = { ...overview, period: { ...overview.period, comparison: { from: "2026-06-01", to: "2026-06-30" } } };
    const html = renderToStaticMarkup(<FinancialOverviewView overview={withComparisonPeriod} />);
    expect(html).toContain("Financial performance");
    expect(html).toContain("Financial summary");
    expect(html).toContain("Comparisons versus Jun 1, 2026 – Jun 30, 2026");
    expect(html).toContain("% data complete");
    expect(html).toContain("Last refreshed");
  });
  it("shows no financial activity to chart rather than a broken chart when the trend is empty", () => {
    const html = renderToStaticMarkup(<FinancialOverviewView overview={overview} />);
    expect(html).toContain("No financial activity is available to chart for this period.");
  });
  it("renders a financial data status summary with completeness and per-source state", () => {
    const html = renderToStaticMarkup(<FinancialOverviewView overview={overview} />);
    expect(html).toContain("Financial data status");
    expect(html).toContain("% complete");
    expect(html).toContain("Cash position");
    expect(html).toContain("Forecast inputs");
  });
  it("renders a print-only disclosure block while the shared shell owns Export", () => {
    const html = renderToStaticMarkup(<FinancialOverviewView overview={{ ...overview, period: { ...overview.period, comparison: { from: "2026-06-01", to: "2026-06-30" } } }} />);
    expect(html).not.toContain('aria-label="Export options"');
    expect(html).toContain("Full Workspace");
    expect(html).toContain("Jul 1, 2026");
    expect(html).toContain("Jun 1, 2026");
    expect(html).toContain("USD");
    expect(html).toContain("Cash position included");
    expect(html).toContain("No (not connected)");
  });
});

describe("Financial Overview CSV exports", () => {
  it("states scope, both reporting periods, currency, completeness, and cash inclusion before the metric table in the summary CSV", () => {
    const csv = buildFinancialSummaryCsv({ ...overview, period: { ...overview.period, comparison: { from: "2026-06-01", to: "2026-06-30" } } });
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain("Scope,Full Workspace");
    expect(csv).toContain("Jun 1, 2026");
    expect(csv).toContain("Currency,USD");
    expect(csv).toContain("Cash position included,No (not connected)");
    expect(csv).toContain("Metric,Current value,Comparison value,Absolute change,Percentage change,Definition");
    expect(csv).toContain("Revenue,");
    expect(csv).toContain("Operating Margin,");
  });
  it("lists expense categories with amount, share, and comparison in the expense-detail CSV", () => {
    const withDrivers: FinancialOverview = { ...overview, drivers: { revenue: [], expenses: [
      { id: "cleaning", label: "Cleaning", amount: Money.usd(842), share: .386, change: Money.usd(-64), qualification: "measured", confidence: "high" },
    ] } };
    const csv = buildExpenseDetailCsv(withDrivers);
    expect(csv).toContain("Category,Amount,% of total,Change vs. previous period");
    expect(csv).toContain("Cleaning,$842,38.6%,'-$64 lower");
  });
  it("neutralizes a leading formula character so a spreadsheet cannot execute it, while leaving ordinary text untouched", () => {
    expect(csvEscape("=CMD('calc')")).toBe("'=CMD('calc')");
    expect(csvEscape("+1-800-555")).toBe("'+1-800-555");
    expect(csvEscape("Cleaning")).toBe("Cleaning");
    expect(csvEscape("Smith, Jones")).toBe('"Smith, Jones"');
  });
});
