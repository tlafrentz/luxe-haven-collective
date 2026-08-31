import { describe, expect, it } from "vitest";
import {
  budgetVariance,
  calculateDesignBudget,
  canTransitionDesignWorkspace,
  classifyPriceFreshness,
  isCustomerMaterialChange,
  validateWorkspaceCapacity,
  validateWorkspaceSelection,
} from "./design-workspaces";
describe("FS-UX-005 Design Workspaces and budgets", () => {
  it("governs review paths", () => {
    expect(canTransitionDesignWorkspace("designing", "internal_review")).toBe(
      true,
    );
    expect(
      canTransitionDesignWorkspace("internal_review", "approved", true),
    ).toBe(false);
    expect(
      canTransitionDesignWorkspace("internal_review", "approved", false),
    ).toBe(true);
  });
  it("uses fixed minor units", () =>
    expect(
      calculateDesignBudget(
        [
          {
            quantity: 2,
            unitPriceMinor: 10000,
            deliveryMinor: 1000,
            taxMinor: 500,
            currency: "USD",
          },
        ],
        1000,
      ),
    ).toMatchObject({
      productSubtotalMinor: 20000,
      deliveryMinor: 1000,
      contingencyMinor: 2150,
      estimatedTotalMinor: 23650,
    }));
  it("rejects mixed currency and fractions", () => {
    expect(() =>
      calculateDesignBudget([
        { quantity: 1, unitPriceMinor: 1, currency: "USD" },
        { quantity: 1, unitPriceMinor: 1, currency: "EUR" },
      ]),
    ).toThrow("MIXED_CURRENCY");
    expect(() =>
      calculateDesignBudget([
        { quantity: 0.5, unitPriceMinor: 1, currency: "USD" },
      ]),
    ).toThrow("LINE_INVALID");
  });
  it("classifies freshness and variance", () => {
    expect(
      classifyPriceFreshness(
        "2026-08-29T00:00:00Z",
        100,
        120,
        new Date("2026-08-30"),
      ),
    ).toBe("changed");
    expect(budgetVariance(15000, 14000)).toEqual({
      amountMinor: 1000,
      percentageBasisPoints: 714,
      overBudget: true,
    });
  });
  it("requires approved same-workspace products", () => {
    expect(() =>
      validateWorkspaceSelection({
        scope: "platform",
        workspaceId: null,
        productWorkspaceId: "w",
        status: "approved",
      }),
    ).toThrow("WRONG_WORKSPACE");
    expect(() =>
      validateWorkspaceSelection({
        scope: "workspace",
        workspaceId: "w",
        productWorkspaceId: "w",
        status: "draft",
      }),
    ).toThrow("INELIGIBLE");
  });
  it("classifies capacity and material changes", () => {
    expect(
      validateWorkspaceCapacity({
        maximumGuests: 6,
        sleeping: 4,
        dining: 6,
        living: 5,
      }),
    ).toHaveLength(2);
    expect(isCustomerMaterialChange(["internal_note"])).toBe(false);
    expect(isCustomerMaterialChange(["quantity"])).toBe(true);
  });
});
