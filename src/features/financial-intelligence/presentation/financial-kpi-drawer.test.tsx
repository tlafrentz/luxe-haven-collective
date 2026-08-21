// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { FinancialKpiRow, type FinancialKpiCard, type FinancialKpiDrawerContent } from "./financial-kpi-drawer";

afterEach(cleanup);

const cards: readonly FinancialKpiCard[] = [
  { id: "revenue", label: "Revenue", value: "$2,604", deltaLine: "+$2,003 · 333.3% higher", captionLine: "vs. previous period" },
  { id: "operating-expenses", label: "Operating Expenses", value: "$1,663", deltaLine: "$515 lower · 23.6% improvement", captionLine: "vs. previous period" },
];
const drawers: readonly FinancialKpiDrawerContent[] = [
  {
    id: "revenue", label: "Revenue", definition: "Recognized operating revenue during the selected period.",
    currentValue: "$2,604", comparisonValue: "$601", absoluteChange: "+$2,003", percentageChange: "+333.3%",
    includedCategories: ["Accommodation"], excludedCategories: ["Non-operating income"],
    dataSources: "3 evidence records · High confidence", lastRefreshed: "Jul 25, 2026, 12:00 PM",
  },
  {
    id: "operating-expenses", label: "Operating Expenses", definition: "Operating expenses incurred during the selected period.",
    currentValue: "$1,663", comparisonValue: "$2,178", absoluteChange: "-$515", percentageChange: "-23.6%",
    includedCategories: ["Cleaning", "Utilities"], excludedCategories: ["Debt principal", "Owner distributions"],
    dataSources: "5 evidence records · High confidence", lastRefreshed: "Jul 25, 2026, 12:00 PM",
    destination: { href: "/dashboard/observe/financial/expenses", label: "View expense details" },
  },
];

describe("FinancialKpiRow", () => {
  it("opens a metric detail dialog with the KPI's definition, values, categories, and evidence when a card is clicked", async () => {
    const user = userEvent.setup();
    render(<FinancialKpiRow cards={cards} drawers={drawers} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Operating Expenses/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Operating expenses incurred during the selected period.");
    expect(dialog.textContent).toContain("$1,663");
    expect(dialog.textContent).toContain("$2,178");
    expect(dialog.textContent).toContain("Cleaning");
    expect(dialog.textContent).toContain("Debt principal");
    expect(dialog.textContent).toContain("5 evidence records");
    expect(screen.getByRole("link", { name: "View expense details" })).toBeTruthy();
  });
  it("does not offer a drill-through link for metrics without a dedicated destination", async () => {
    const user = userEvent.setup();
    render(<FinancialKpiRow cards={cards} drawers={drawers} />);
    await user.click(screen.getByRole("button", { name: /^Revenue/ }));
    expect(screen.queryByRole("link", { name: "View expense details" })).toBeNull();
  });
  it("closes the dialog on Escape", async () => {
    const user = userEvent.setup();
    render(<FinancialKpiRow cards={cards} drawers={drawers} />);
    await user.click(screen.getByRole("button", { name: /^Revenue/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("closes the dialog when the close button is activated", async () => {
    const user = userEvent.setup();
    render(<FinancialKpiRow cards={cards} drawers={drawers} />);
    await user.click(screen.getByRole("button", { name: /^Revenue/ }));
    await user.click(screen.getByRole("button", { name: "Close metric detail" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
