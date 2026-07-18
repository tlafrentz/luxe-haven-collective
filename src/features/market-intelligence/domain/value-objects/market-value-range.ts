export interface MarketValueRangeInput {
  readonly low: number;
  readonly estimated: number;
  readonly high: number;
}

export class MarketValueRange {
  readonly low: number;

  readonly estimated: number;

  readonly high: number;

  constructor(
    input:
      MarketValueRangeInput,
  ) {
    const values = [
      input.low,
      input.estimated,
      input.high,
    ];

    if (
      values.some(
        (value) =>
          !Number.isFinite(value) ||
          value < 0,
      )
    ) {
      throw new Error(
        "Market value range values must be finite non-negative numbers.",
      );
    }

    if (
      input.low >
        input.estimated ||
      input.estimated >
        input.high
    ) {
      throw new Error(
        "Market value range must satisfy low <= estimated <= high.",
      );
    }

    this.low =
      roundCurrency(
        input.low,
      );

    this.estimated =
      roundCurrency(
        input.estimated,
      );

    this.high =
      roundCurrency(
        input.high,
      );
  }

  get spread(): number {
    return roundCurrency(
      this.high -
        this.low,
    );
  }

  get spreadRatio(): number {
    if (
      this.estimated === 0
    ) {
      return 0;
    }

    return (
      Math.round(
        (
          this.spread /
          this.estimated
        ) * 10000,
      ) / 10000
    );
  }
}

function roundCurrency(
  value: number,
): number {
  return (
    Math.round(
      value * 100,
    ) / 100
  );
}
