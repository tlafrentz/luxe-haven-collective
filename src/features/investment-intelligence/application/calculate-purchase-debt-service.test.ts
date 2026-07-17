import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculatePurchaseDebtService,
} from "./calculate-purchase-debt-service";

describe(
  "calculatePurchaseDebtService",
  () => {
    it(
      "calculates amortized debt service for a financed purchase",
      () => {
        const result =
          calculatePurchaseDebtService({
            purchasePrice: 400000,
            downPaymentPercentage: 20,
            annualInterestRatePercentage: 6.5,
            loanTermYears: 30,
          });

        expect(
          result.downPaymentAmount.amount,
        ).toBe(80000);

        expect(
          result.loanAmount.amount,
        ).toBe(320000);

        expect(
          result.loanToValueRatio.value,
        ).toBe(80);

        expect(
          result
            .monthlyPrincipalAndInterest
            .amount,
        ).toBe(2022.62);

       expect(
  result.annualDebtService.amount,
).toBe(24271.41);

expect(
  result.totalInterestPaid.amount,
).toBe(408142.36);

      },
    );

    it(
      "supports a zero-interest loan",
      () => {
        const result =
          calculatePurchaseDebtService({
            purchasePrice: 120000,
            downPaymentPercentage: 0,
            annualInterestRatePercentage: 0,
            loanTermYears: 10,
          });

        expect(
          result
            .monthlyPrincipalAndInterest
            .amount,
        ).toBe(1000);

        expect(
          result.annualDebtService.amount,
        ).toBe(12000);

        expect(
          result.totalInterestPaid.amount,
        ).toBe(0);
      },
    );

    it(
      "supports a fully cash-funded purchase",
      () => {
        const result =
          calculatePurchaseDebtService({
            purchasePrice: 250000,
            downPaymentPercentage: 100,
            annualInterestRatePercentage: 7,
            loanTermYears: 30,
          });

        expect(
          result.loanAmount.amount,
        ).toBe(0);

        expect(
          result
            .monthlyPrincipalAndInterest
            .amount,
        ).toBe(0);

        expect(
          result.annualDebtService.amount,
        ).toBe(0);

        expect(
          result.totalInterestPaid.amount,
        ).toBe(0);
      },
    );

    it.each([
      {
        input: {
          purchasePrice: 0,
          downPaymentPercentage: 20,
          annualInterestRatePercentage: 6,
          loanTermYears: 30,
        },
        message:
          "purchasePrice must be a finite number greater than zero.",
      },
      {
        input: {
          purchasePrice: 300000,
          downPaymentPercentage: 101,
          annualInterestRatePercentage: 6,
          loanTermYears: 30,
        },
        message:
          "downPaymentPercentage cannot exceed 100.",
      },
      {
        input: {
          purchasePrice: 300000,
          downPaymentPercentage: 20,
          annualInterestRatePercentage: -1,
          loanTermYears: 30,
        },
        message:
          "annualInterestRatePercentage must be a finite, non-negative number.",
      },
      {
        input: {
          purchasePrice: 300000,
          downPaymentPercentage: 20,
          annualInterestRatePercentage: 6,
          loanTermYears: 0,
        },
        message:
          "loanTermYears must be a positive integer.",
      },
    ])(
      "rejects invalid financing assumptions",
      ({ input, message }) => {
        expect(
          () =>
            calculatePurchaseDebtService(
              input,
            ),
        ).toThrow(message);
      },
    );
  },
);
