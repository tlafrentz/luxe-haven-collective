// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { recordExpense, result } = vi.hoisted(() => ({
  recordExpense: vi.fn(async (...submission: [unknown, FormData]) => {
    void submission;
    return result.current;
  }),
  result: { current: { ok: false, message: "Review the entered expense." } as { ok?: boolean; duplicate?: boolean; message?: string } },
}));

vi.mock("@/app/actions/financial-observations", () => ({
  recordFinancialExpenseAction: recordExpense,
  updateFinancialExpenseAction: vi.fn(),
  archiveFinancialExpenseAction: vi.fn(),
  restoreFinancialExpensesAction: vi.fn(),
  deleteFinancialExpensesAction: vi.fn(),
}));

import { categoryGradientStops, OperatingExpensesWorkspace } from "./expense-workspace";

const props = {
  initialExpenses: [],
  properties: [{ id: "10000000-0000-4000-8000-000000000001", name: "Lake House" }],
  workspaceId: "20000000-0000-4000-8000-000000000002",
  currency: "USD",
  basis: "actual" as const,
};

function commandId() {
  return (document.querySelector('input[name="idempotencyKey"]') as HTMLInputElement).value;
}

async function openAndCompleteForm() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Add expense" }));
  await user.type(screen.getByLabelText("Amount (USD)"), "123.45");
  fireEvent.input(screen.getByLabelText("Effective date"), { target: { value: "2026-08-01" } });
  return user;
}

describe("Expense Workspace", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState({}, "", "/dashboard/financial/expenses");
    let sequence = 0;
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      sequence += 1;
      return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`;
    });
    result.current = { ok: false, message: "Review the entered expense." };
  });

  afterEach(() => cleanup());

  it("calculates pure sequential category stops", () => {
    expect(categoryGradientStops([{ amountMinor: 25 }, { amountMinor: 75 }], ["red", "blue"])).toBe(
      "red 0% 25%,blue 25% 100%",
    );
  });

  it("handles zero-total categories without division errors", () => {
    const stops = categoryGradientStops([{ amountMinor: 0 }, { amountMinor: 0 }], ["red", "blue"]);
    expect(stops).toBe("red 0% 0%,blue 0% 0%");
    expect(stops).not.toMatch(/NaN|Infinity/);
  });

  it("keeps archived expenses out of category, recurring, highlight, and trend calculations", () => {
    const shared = {
      propertyId: props.properties[0].id,
      propertyName: "Lake House",
      accountId: "expense",
      category: "cleaning" as const,
      currency: "USD",
      basis: "actual" as const,
      effectiveDate: "2026-08-01",
      frequency: "monthly" as const,
      source: "manual",
    };
    render(<OperatingExpensesWorkspace {...props} initialView="category" initialExpenses={[
      { ...shared, id: "active", name: "active cleaning", amountMinor: 10_000, status: "recorded" },
      { ...shared, id: "archived", name: "archived cleaning", amountMinor: 99_900, status: "archived" },
    ]} />);

    expect(screen.getByRole("img", { name: "Expense composition totaling $100.00" })).toBeTruthy();
    expect(screen.queryByText("$999.00")).toBeNull();
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(1);
  });

  it("defaults the ledger to active expenses and exposes archived metadata on demand", async () => {
    const shared = {
      propertyId: props.properties[0].id, propertyName: "Lake House", accountId: "expense",
      category: "cleaning" as const, currency: "USD", basis: "actual" as const,
      effectiveDate: "2026-08-01", frequency: "one-time" as const, source: "manual",
    };
    render(<OperatingExpensesWorkspace {...props} initialExpenses={[
      { ...shared, id: "active", name: "active cleaning", amountMinor: 10_000, status: "recorded" },
      { ...shared, id: "archived", name: "archived cleaning", amountMinor: 99_900, status: "archived", archivedAt: "2026-08-02T00:00:00Z" },
    ]} />);

    expect(screen.getByText("Active Cleaning")).toBeTruthy();
    expect(screen.queryByText("Archived Cleaning")).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText("Status"), "archived");
    expect(screen.getByText("Archived Cleaning")).toBeTruthy();
    expect(screen.getByText("Aug 2, 2026")).toBeTruthy();
    expect(new URL(location.href).searchParams.get("status")).toBe("archived");
    expect(localStorage.getItem("financial-expenses:status")).toBe("archived");
  });

  it("keeps a command ID stable across field updates and rerenders, then creates a new ID for a new modal", async () => {
    const view = render(<OperatingExpensesWorkspace {...props} />);
    const user = await openAndCompleteForm();
    const first = commandId();
    await user.type(screen.getByLabelText("Source reference"), "invoice-1");
    view.rerender(<OperatingExpensesWorkspace {...props} />);
    expect(commandId()).toBe(first);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Add expense" }));
    expect(commandId()).not.toBe(first);
  });

  it("reuses the command ID across recoverable retries and preserves entered data", async () => {
    render(<OperatingExpensesWorkspace {...props} />);
    await openAndCompleteForm();
    const first = commandId();
    fireEvent.submit(screen.getByRole("button", { name: "Record expense" }).closest("form")!);
    await waitFor(() => expect(recordExpense).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((screen.getByRole("button", { name: "Record expense" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.submit(screen.getByRole("button", { name: "Record expense" }).closest("form")!);
    await waitFor(() => expect(recordExpense).toHaveBeenCalledTimes(2));

    const submittedIds = recordExpense.mock.calls.map((call) => (call[1] as FormData).get("idempotencyKey"));
    expect(submittedIds).toEqual([first, first]);
    expect((screen.getByLabelText("Amount (USD)") as HTMLInputElement).value).toBe("123.45");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("adds a successful expense and closes the modal exactly once", async () => {
    result.current = { ok: true, duplicate: false };
    render(<OperatingExpensesWorkspace {...props} />);
    const user = await openAndCompleteForm();
    await user.click(screen.getByRole("button", { name: "Record expense" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getAllByText("$123.45").length).toBeGreaterThan(0);
    expect(screen.getByText("Showing 1 result")).toBeTruthy();
  });

  it("does not close for a duplicate response", async () => {
    result.current = { ok: false, duplicate: true, message: "An exact duplicate already exists." };
    render(<OperatingExpensesWorkspace {...props} />);
    const user = await openAndCompleteForm();
    await user.click(screen.getByRole("button", { name: "Record expense" }));

    await waitFor(() => expect(screen.getByText("An exact duplicate already exists.")).toBeTruthy());
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((screen.getByLabelText("Amount (USD)") as HTMLInputElement).value).toBe("123.45");
  });

  it("has no runtime path from the client workspace to server-only modules", () => {
    const workspace = readFileSync("src/features/financial-intelligence/presentation/expense-workspace.tsx", "utf8");
    const expenses = readFileSync("src/features/financial-intelligence/application/expenses.ts", "utf8");
    expect(workspace).toContain('from "../application/expenses"');
    expect(workspace).not.toMatch(/from ["']\.\.\/application["']/);
    expect(`${workspace}\n${expenses}`).not.toMatch(/next\/headers|lib\/supabase\/server|\.\.\/infrastructure/);
  });
});
