import { describe, expect, it } from "vitest";
import type { AutomationPolicy } from "./automation-policy";
import { AutomationPolicyRegistry } from "./automation-policy-registry";

const policy: AutomationPolicy = { name: "safety", supports: () => true, govern: () => ({ allowed: true }) };
describe("AutomationPolicyRegistry", () => {
  it("registers, resolves, and enumerates policies immutably", () => {
    const empty = AutomationPolicyRegistry.empty(), registry = empty.register(policy);
    expect(empty.size).toBe(0); expect(registry.require("safety")).toBe(policy); expect([...registry]).toEqual([policy]);
  });
  it("rejects duplicate and invalid policies", () => {
    expect(() => AutomationPolicyRegistry.create([policy, policy])).toThrow("Automation policy names must be unique.");
    expect(() => AutomationPolicyRegistry.create([{ name: "bad" } as AutomationPolicy])).toThrow('Automation policy "bad" is invalid.');
  });
});
