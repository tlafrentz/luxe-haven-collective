import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculateAnnualDebtService,
} from "./calculate-annual-debt-service";

describe("calculateAnnualDebtService", () => {
  it("calculates annual mortgage debt service", () => {
    const result =
      calculateAnnualDebtService({
        purchasePrice: 425000,
        downPaymentPercentage: 25,
        annualInterestRatePercentage: 6.5,
        loanTermYears: 30,
      });

    expect(result).toBe(24176.6);
  });

  it("returns zero for an all-cash acquisition", () => {
    expect(
      calculateAnnualDebtService({
        purchasePrice: 425000,
        downPaymentPercentage: 100,
        annualInterestRatePercentage: 6.5,
        loanTermYears: 30,
      }),
    ).toBe(0);
  });

  it("supports zero-interest financing", () => {
    expect(
      calculateAnnualDebtService({
        purchasePrice: 300000,
        downPaymentPercentage: 20,
        annualInterestRatePercentage: 0,
        loanTermYears: 30,
      }),
    ).toBe(8000);
  });

  it("rejects a down payment above 100 percent", () => {
    expect(() =>
      calculateAnnualDebtService({
        purchasePrice: 425000,
        downPaymentPercentage: 101,
        annualInterestRatePercentage: 6.5,
        loanTermYears: 30,
      }),
    ).toThrow(
      "downPaymentPercentage cannot exceed 100.",
    );
  });

  it("rejects a zero loan term when financing is used", () => {
    expect(() =>
      calculateAnnualDebtService({
        purchasePrice: 425000,
        downPaymentPercentage: 25,
        annualInterestRatePercentage: 6.5,
        loanTermYears: 0,
      }),
    ).toThrow(
      "loanTermYears must be a positive integer.",
    );
  });
});
