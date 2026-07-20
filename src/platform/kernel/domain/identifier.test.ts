import { describe, expect, it } from "vitest";

import { Identifier } from "./identifier";

describe("Identifier", () => {
  it("creates an identifier from a non-empty string", () => {
    const identifier = Identifier.create("property-123");

    expect(identifier.value).toBe("property-123");
  });

  it("preserves the original identifier string", () => {
    const identifier = Identifier.create("  property-123  ");

    expect(identifier.value).toBe("  property-123  ");
  });

  it("rejects empty identifiers", () => {
    expect(() => Identifier.create("")).toThrow(TypeError);
  });

  it("rejects whitespace-only identifiers", () => {
    expect(() => Identifier.create("   ")).toThrow(
      "Identifier value cannot be empty.",
    );
  });

  it("compares identifiers by value", () => {
    expect(
      Identifier.create("one").equals(Identifier.create("one")),
    ).toBe(true);
  });

  it("returns false for a different identifier value", () => {
    expect(
      Identifier.create("one").equals(Identifier.create("two")),
    ).toBe(false);
  });

  it("returns false for unrelated values", () => {
    expect(Identifier.create("one").equals("one")).toBe(false);
  });

  it("serializes to its string value", () => {
    const identifier = Identifier.create("property-123");

    expect(identifier.toString()).toBe("property-123");
    expect(identifier.toJSON()).toBe("property-123");
    expect(JSON.stringify(identifier)).toBe('"property-123"');
  });

  it("retains literal typing", () => {
    const identifier = Identifier.create("property-123" as const);
    const value: "property-123" = identifier.value;

    expect(value).toBe("property-123");
  });
});
