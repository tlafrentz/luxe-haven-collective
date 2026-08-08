import { describe, expect, it } from "vitest";
import {
  money,
  multiplyMoney,
  resolveQuantity,
  type QuantityRule,
} from "./schema";

const rule = (overrides: Partial<QuantityRule> = {}): QuantityRule => ({
  id: "rule",
  ruleType: "per_guest",
  multiplier: 2,
  minimum: null,
  maximum: null,
  customExpression: null,
  rounding: "up",
  ...overrides,
});
const facts = { bedrooms: 3, bathrooms: 2, guests: 8, rooms: 9, beds: 4 };

describe("FS-001 canonical furnishing schema", () => {
  it("uses integer minor units and snapshots extended price", () => {
    expect(multiplyMoney(money(15464), 2)).toEqual({
      amountMinor: 30928,
      currency: "USD",
    });
    expect(() => money(10.5)).toThrow("FURNISHING_MONEY_INVALID");
  });
  it("resolves deterministic quantity rules from property and room facts", () => {
    expect(resolveQuantity(rule(), facts)).toBe(16);
    expect(
      resolveQuantity(rule({ ruleType: "per_bed", multiplier: 2 }), facts),
    ).toBe(8);
    expect(
      resolveQuantity(
        rule({ ruleType: "fixed", multiplier: 0.5, minimum: 1 }),
        facts,
      ),
    ).toBe(1);
  });
  it("rejects executable custom expressions at the domain boundary", () => {
    expect(() =>
      resolveQuantity(
        rule({ ruleType: "custom", customExpression: "process.exit()" }),
        facts,
      ),
    ).toThrow("FURNISHING_CUSTOM_RULE_UNAVAILABLE");
  });
});
