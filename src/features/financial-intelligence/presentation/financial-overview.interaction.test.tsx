// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Money } from "@/platform/kernel";
import type { FinancialOverview } from "../application";
import { FinancialOverviewView } from "./financial-overview";

afterEach(cleanup);

const overview: FinancialOverview = {
  identity: { workspaceId: "w", organizationId: "o", reportingCurrency: "USD", fiscalYearStartMonth: 1, timezone: "UTC", reportingStandards: ["GAAP"], accountingMethod: "accrual" },
  scope: { type: "workspace", label: "Full Workspace", propertyIds: ["one"], propertyCount: 1 },
  period: { kind: "month", from: "2026-07-01", to: "2026-07-31", comparison: { from: "2026-06-01", to: "2026-06-30" }, reportingCalendar: "fiscal" },
  accountingBasis: "accrual", reportingCurrency: "USD",
  condition: { status: "stable", summary: "No material condition dominates.", positiveDrivers: ["Positive NOI."], limitingConditions: [], confidence: "high", evidenceIds: ["e"], policyVersion: "v1" },
  metrics: [
    { metric: "revenue", current: { money: Money.usd(2604), qualification: "measured" }, comparison: { money: Money.usd(601), qualification: "measured" }, change: { amount: Money.usd(2003), percentageChange: 3.333, kind: "absolute-and-percentage", direction: "improved" }, availability: "available", confidence: "high", freshness: "current", evidenceIds: ["e1", "e2"] },
    { metric: "operating-expenses", current: { money: Money.usd(1663), qualification: "measured" }, comparison: { money: Money.usd(2178), qualification: "measured" }, change: { amount: Money.usd(-515), percentageChange: -.236, kind: "absolute-and-percentage", direction: "improved" }, availability: "available", confidence: "high", freshness: "current", evidenceIds: ["e3"] },
    { metric: "noi", current: { money: Money.usd(941), qualification: "measured" }, availability: "available", confidence: "high", freshness: "current", evidenceIds: ["e4"] },
    { metric: "operating-margin", current: { percentage: .362, qualification: "measured" }, availability: "available", confidence: "high", freshness: "current", evidenceIds: ["e5"] },
  ],
  profitability: { status: "profitable", noi: { money: Money.usd(941), qualification: "measured" }, margin: { percentage: .362, qualification: "measured" }, explanation: "Profitable.", confidence: "high" },
  liquidity: { status: "insufficient-evidence", cash: { qualification: "unavailable", limitation: "Missing cash." }, movement: { qualification: "unavailable" }, reserveTargetConfigured: false, explanation: "Cash unavailable.", confidence: "insufficient-evidence" },
  changes: [], drivers: { revenue: [{ id: "accommodation", label: "Accommodation", amount: Money.usd(2604), share: 1, qualification: "measured", confidence: "high" }], expenses: [{ id: "cleaning", label: "Cleaning", amount: Money.usd(842), share: .5, qualification: "measured", confidence: "high" }] },
  propertyContribution: [], obligations: { sourceAvailable: false, items: [] },
  planning: { available: false, status: "unavailable", lines: [], explanation: "No approved budget." }, attention: [],
  execution: { activeDecisions: 0, openActions: 0, items: [] },
  evidence: { revenueCoverage: 1, expenseCoverage: 1, cashCoverage: 0, propertyCoverage: 1, accountCoverage: 1, categorizationCoverage: 1, uncategorizedTransactionCount: 0, reconciliation: "unknown", historyMonths: 12, gaps: [] },
  performanceTrend: [],
  confidence: "high", freshness: "current", evaluatedAt: "2026-07-25T12:00:00Z", projectionVersion: "v1", state: "partial", permissionLimited: false,
};

describe("FinancialOverviewView KPI detail drawer", () => {
  it("assembles real metric, comparison, driver, and evidence data into the Operating Expenses drawer and links to the Expenses tab", async () => {
    const user = userEvent.setup();
    render(<FinancialOverviewView overview={overview} />);
    await user.click(screen.getByRole("button", { name: /Operating Expenses/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("$1,663");
    expect(dialog.textContent).toContain("$2,178");
    expect(dialog.textContent).toContain("Cleaning");
    expect(dialog.textContent).toContain("Debt principal");
    expect(dialog.textContent).toContain("1 evidence record");
    expect(within(dialog).getByRole("link", { name: "View expense details" }).getAttribute("href")).toBe("/dashboard/observe/financial/expenses");
  });
  it("shows revenue-specific categories and no drill-through link in the Revenue drawer", async () => {
    const user = userEvent.setup();
    render(<FinancialOverviewView overview={overview} />);
    await user.click(screen.getByRole("button", { name: /^Revenue/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Accommodation");
    expect(dialog.textContent).toContain("+$2,003");
    expect(within(dialog).queryByRole("link", { name: "View expense details" })).toBeNull();
  });
  it("expresses the Operating Margin drawer's absolute change in percentage points, not a relative percent", async () => {
    const withMarginChange: FinancialOverview = {
      ...overview,
      metrics: overview.metrics.map(metric => metric.metric === "operating-margin"
        ? { ...metric, comparison: { percentage: .108, qualification: "measured" }, change: { kind: "absolute-only", direction: "improved", percentagePointChange: .254 } }
        : metric),
    };
    const user = userEvent.setup();
    render(<FinancialOverviewView overview={withMarginChange} />);
    await user.click(screen.getByRole("button", { name: /Operating Margin/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("+25.4 pts");
    expect(dialog.textContent).toContain("Not applicable");
  });
});
