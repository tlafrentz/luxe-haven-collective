import { ValueObject } from "./value-object";

type MoneyProps = {
  readonly amount: number;
  readonly currency: string;
};

export class Money extends ValueObject<MoneyProps> {
  private constructor(amount: number, currency: string) {
    super({ amount, currency });
  }

  public static usd(amount: number): Money {
    return Money.of(amount, "USD");
  }

  public static of(amount: number, currency: string): Money {
    if (!Number.isFinite(amount)) {
      throw new TypeError("Money amount must be finite.");
    }
    const normalizedCurrency = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      throw new TypeError("Money currency must be a three-letter ISO 4217 code.");
    }
    return new Money(Money.round(amount, normalizedCurrency), normalizedCurrency);
  }

  public static fromMinorUnits(minorUnits: number, currency = "USD"): Money {
    if (!Number.isSafeInteger(minorUnits)) {
      throw new TypeError("Money minor units must be a safe integer.");
    }
    return Money.of(minorUnits / 10 ** Money.precisionFor(currency), currency);
  }

  public static zero(currency = "USD"): Money {
    return Money.of(0, currency);
  }

  public get amount(): number {
    return this.props.amount;
  }

  public get currency(): string {
    return this.props.currency;
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromMinorUnits(this.minorUnits + other.minorUnits, this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromMinorUnits(this.minorUnits - other.minorUnits, this.currency);
  }

  public multiply(multiplier: number): Money {
    if (!Number.isFinite(multiplier)) throw new TypeError("Money multiplier must be finite.");
    return Money.fromMinorUnits(Math.round(this.minorUnits * multiplier), this.currency);
  }

  public compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    return this.minorUnits === other.minorUnits ? 0 : this.minorUnits < other.minorUnits ? -1 : 1;
  }

  public get minorUnits(): number {
    return Math.round(this.amount * 10 ** Money.precisionFor(this.currency));
  }

  public serialize(): Readonly<{ amount: number; currency: string; minorUnits: number; precision: number }> {
    return Object.freeze({
      amount: this.amount,
      currency: this.currency,
      minorUnits: this.minorUnits,
      precision: Money.precisionFor(this.currency),
    });
  }

  public format(locale = "en-US"): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: this.currency,
      minimumFractionDigits: Money.precisionFor(this.currency),
      maximumFractionDigits: Money.precisionFor(this.currency),
    }).format(this.amount);
  }

  public isNegative(): boolean {
    return this.amount < 0;
  }

  public static precisionFor(currency: string): number {
    const code = currency.toUpperCase();
    if (["BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "UYI", "VND", "VUV", "XAF", "XOF", "XPF"].includes(code)) return 0;
    if (["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"].includes(code)) return 3;
    return 2;
  }

  private static round(amount: number, currency: string): number {
    const factor = 10 ** Money.precisionFor(currency);
    return Math.round((amount + Number.EPSILON) * factor) / factor;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new TypeError(`Cannot combine ${this.currency} and ${other.currency} money.`);
    }
  }
}
