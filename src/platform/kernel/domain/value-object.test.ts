import { describe, expect, it } from "vitest";

import { ValueObject } from "./value-object";

class Money extends ValueObject<{
  readonly amount: number;
  readonly currency: string;
}> {
  public constructor(amount: number, currency = "USD") {
    super({ amount, currency });
  }

  public get amount(): number {
    return this.props.amount;
  }
}

class Price extends ValueObject<{
  readonly amount: number;
  readonly currency: string;
}> {
  public constructor(amount: number, currency = "USD") {
    super({ amount, currency });
  }
}

class Schedule extends ValueObject<{
  readonly dates: readonly Date[];
  readonly labels: readonly string[];
}> {
  public constructor(dates: readonly Date[], labels: readonly string[]) {
    super({ dates, labels });
  }
}

describe("ValueObject", () => {
  it("compares objects of the same type by structural value", () => {
    expect(new Money(100).equals(new Money(100))).toBe(true);
  });

  it("returns false when a property differs", () => {
    expect(new Money(100).equals(new Money(200))).toBe(false);
  });

  it("returns false for different concrete value-object types", () => {
    expect(new Money(100).equals(new Price(100))).toBe(false);
  });

  it("returns false for non-value objects", () => {
    expect(
      new Money(100).equals({ amount: 100, currency: "USD" }),
    ).toBe(false);
  });

  it("supports nested arrays and dates", () => {
    const first = new Schedule(
      [new Date("2026-01-01T00:00:00.000Z")],
      ["launch"],
    );
    const second = new Schedule(
      [new Date("2026-01-01T00:00:00.000Z")],
      ["launch"],
    );

    expect(first.equals(second)).toBe(true);
  });

  it("copies input values so later source mutations do not change state", () => {
    const dates = [new Date("2026-01-01T00:00:00.000Z")];
    const schedule = new Schedule(dates, ["launch"]);

    dates[0].setUTCFullYear(2030);

    expect(
      schedule.equals(
        new Schedule(
          [new Date("2026-01-01T00:00:00.000Z")],
          ["launch"],
        ),
      ),
    ).toBe(true);
  });

  it("freezes the value object instance", () => {
    expect(Object.isFrozen(new Money(100))).toBe(true);
  });
});
