import { describe, expect, it } from "vitest";
import { policy } from "../intelligence-fixtures.test-support";
import type { IntelligencePolicy } from "./intelligence-policy";
import { IntelligencePolicyRegistry } from "./intelligence-policy-registry";

describe("IntelligencePolicyRegistry", () => {
  it("registers, resolves, and enumerates policies immutably", () => {
    const empty = IntelligencePolicyRegistry.empty(), registry = empty.register(policy);
    expect(empty.size).toBe(0); expect(registry.require("performance-intelligence")).toBe(policy); expect([...registry]).toEqual([policy]);
  });
  it("rejects duplicate and invalid policies", () => {
    expect(() => IntelligencePolicyRegistry.create([policy, policy])).toThrow("Intelligence policy names must be unique.");
    expect(() => IntelligencePolicyRegistry.create([{ name: "invalid" } as IntelligencePolicy])).toThrow('Intelligence policy "invalid" is invalid.');
  });
});
