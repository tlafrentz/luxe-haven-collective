import { ValueObject } from "./value-object";

type MoneyProps = {
  readonly amount: number;
  readonly currency: "USD";
};

export class Money extends ValueObject<MoneyProps> {
  private constructor(amount: number) {
    super({ amount, currency: "USD" });
  }

  public static usd(amount: number): Money {
    if (!Number.isFinite(amount)) {
      throw new TypeError("Money amount must be finite.");
    }

    return new Money(amount);
  }

  public static zero(): Money {
    return Money.usd(0);
  }

  public get amount(): number {
    return this.props.amount;
  }

  public get currency(): "USD" {
    return this.props.currency;
  }

  public add(other: Money): Money {
    return Money.usd(this.amount + other.amount);
  }

  public subtract(other: Money): Money {
    return Money.usd(this.amount - other.amount);
  }

  public isNegative(): boolean {
    return this.amount < 0;
  }
}
