import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculateExpenseProjection,
} from "./calculate-expense-projection";

function usd(amount: number) {
  return {
    amount,
    currency: "USD" as const,
  };
}

describe("calculateExpenseProjection", () => {
  it("calculates annual operating expenses without including mortgage debt service", () => {
    const result =
      calculateExpenseProjection({
        mortgage: usd(24000),
        cleaning: usd(7200),
        utilities: usd(3600),
        insurance: usd(1800),
        taxes: usd(4200),
        management: usd(9600),
        maintenance: usd(2400),
        software: usd(1200),
        supplies: usd(1800),
        capitalReserve: usd(3000),
        confidence: {
          value: 85,
        },
      });

    expect(
      result.totalOperatingExpenses,
    ).toEqual({
      amount: 34800,
      currency: "USD",
    });

    expect(result.mortgage).toEqual(
      usd(24000),
    );
  });

  it("supports zero-dollar expense categories", () => {
    const result =
      calculateExpenseProjection({
        mortgage: usd(0),
        cleaning: usd(5000),
        utilities: usd(3000),
        insurance: usd(1500),
        taxes: usd(3500),
        management: usd(0),
        maintenance: usd(2000),
        software: usd(0),
        supplies: usd(1000),
        capitalReserve: usd(2500),
        confidence: {
          value: 75,
        },
      });

    expect(
      result.totalOperatingExpenses.amount,
    ).toBe(18500);
  });

  it("rounds the operating expense total to cents", () => {
    const result =
      calculateExpenseProjection({
        mortgage: usd(12000),
        cleaning: usd(1000.115),
        utilities: usd(2000.115),
        insurance: usd(0),
        taxes: usd(0),
        management: usd(0),
        maintenance: usd(0),
        software: usd(0),
        supplies: usd(0),
        capitalReserve: usd(0),
        confidence: {
          value: 80,
        },
      });

    expect(
      result.totalOperatingExpenses.amount,
    ).toBe(3000.23);
  });

  it("rejects a negative operating expense", () => {
    expect(() =>
      calculateExpenseProjection({
        mortgage: usd(12000),
        cleaning: usd(-1),
        utilities: usd(3000),
        insurance: usd(1500),
        taxes: usd(3500),
        management: usd(5000),
        maintenance: usd(2000),
        software: usd(500),
        supplies: usd(1000),
        capitalReserve: usd(2500),
        confidence: {
          value: 80,
        },
      }),
    ).toThrow(
      "Cleaning must be a finite, non-negative number.",
    );
  });

  it.each([
    -1,
    101,
  ])(
    "rejects confidence outside the 0 to 100 range: %s",
    (value) => {
      expect(() =>
        calculateExpenseProjection({
          mortgage: usd(12000),
          cleaning: usd(5000),
          utilities: usd(3000),
          insurance: usd(1500),
          taxes: usd(3500),
          management: usd(5000),
          maintenance: usd(2000),
          software: usd(500),
          supplies: usd(1000),
          capitalReserve: usd(2500),
          confidence: {
            value,
          },
        }),
      ).toThrow(
        "Confidence must be between 0 and 100.",
      );
    },
  );
});
