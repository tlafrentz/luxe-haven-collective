import { describe, expect, it } from "vitest";
import { policy } from "../outcome-fixtures.test-support";
import type { OutcomePolicy } from "./outcome-policy";
import { OutcomePolicyRegistry } from "./outcome-policy-registry";

describe("OutcomePolicyRegistry", () => {
  it("registers, resolves, and enumerates policies immutably", () => {
    const empty = OutcomePolicyRegistry.empty(), registry = empty.register(policy);
    expect(empty.size).toBe(0); expect(registry.require("record-execution")).toBe(policy); expect([...registry]).toEqual([policy]);
  });
  it("rejects duplicate and invalid policies", () => {
    expect(() => OutcomePolicyRegistry.create([policy, policy])).toThrow("Outcome policy names must be unique.");
    expect(() => OutcomePolicyRegistry.create([{ name: "invalid" } as OutcomePolicy])).toThrow('Outcome policy "invalid" is invalid.');
  });
});
