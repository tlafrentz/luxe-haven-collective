import { describe, expect, it } from "vitest";

import { DecisionContext } from "./decision-context";

describe("DecisionContext", () => {
  it("creates reproducible decision context", () => {
    const context = DecisionContext.create({
      subjectType: "property",
      subjectId: "mesa-downtown-retreat",
      effectiveAt: new Date("2026-07-19T12:00:00.000Z"),
      scope: "acquisition",
      scenario: "purchase",
      attributes: {
        market: "Mesa, AZ",
        currency: "USD",
      },
    });

    expect(context.subjectType).toBe("property");
    expect(context.subjectId).toBe(
      "mesa-downtown-retreat",
    );
    expect(context.scope).toBe("acquisition");
    expect(context.scenario).toBe("purchase");
    expect(context.effectiveAt.toISOString()).toBe(
      "2026-07-19T12:00:00.000Z",
    );
    expect(context.getAttribute("market")).toBe("Mesa, AZ");
  });

  it("trims text values and sorts attributes", () => {
    const context = DecisionContext.create({
      subjectType: " property ",
      subjectId: " mesa ",
      effectiveAt: new Date("2026-07-19T12:00:00.000Z"),
      attributes: {
        zeta: " last ",
        alpha: " first ",
      },
    });

    expect(context.subjectType).toBe("property");
    expect(context.subjectId).toBe("mesa");
    expect(Object.keys(context.attributes)).toEqual([
      "alpha",
      "zeta",
    ]);
    expect(context.attributes.alpha).toBe("first");
  });

  it("omits blank optional text", () => {
    const context = DecisionContext.create({
      subjectType: "property",
      subjectId: "mesa",
      effectiveAt: new Date("2026-07-19T12:00:00.000Z"),
      scope: " ",
      scenario: "",
    });

    expect(context.scope).toBeUndefined();
    expect(context.scenario).toBeUndefined();
  });

  it("rejects an invalid effective date", () => {
    expect(() =>
      DecisionContext.create({
        subjectType: "property",
        subjectId: "mesa",
        effectiveAt: new Date("invalid"),
      }),
    ).toThrow(
      "Decision context effective date must be valid.",
    );
  });

  it("rejects missing subject identity", () => {
    expect(() =>
      DecisionContext.create({
        subjectType: " ",
        subjectId: "mesa",
        effectiveAt: new Date(),
      }),
    ).toThrow(
      "Decision context subject type cannot be empty.",
    );

    expect(() =>
      DecisionContext.create({
        subjectType: "property",
        subjectId: " ",
        effectiveAt: new Date(),
      }),
    ).toThrow(
      "Decision context subject ID cannot be empty.",
    );
  });

  it("rejects blank attribute values", () => {
    expect(() =>
      DecisionContext.create({
        subjectType: "property",
        subjectId: "mesa",
        effectiveAt: new Date(),
        attributes: {
          market: " ",
        },
      }),
    ).toThrow(
      "Decision context attribute value cannot be empty.",
    );
  });

  it("protects itself from source mutation", () => {
    const attributes: Record<string, string> = {
      market: "Mesa, AZ",
    };

    const context = DecisionContext.create({
      subjectType: "property",
      subjectId: "mesa",
      effectiveAt: new Date("2026-07-19T12:00:00.000Z"),
      attributes,
    });

    attributes.market = "Phoenix, AZ";

    expect(context.attributes.market).toBe("Mesa, AZ");
  });

  it("compares by complete value", () => {
    const input = {
      subjectType: "property",
      subjectId: "mesa",
      effectiveAt: new Date("2026-07-19T12:00:00.000Z"),
    };

    expect(
      DecisionContext.create(input).equals(
        DecisionContext.create(input),
      ),
    ).toBe(true);
  });
});
