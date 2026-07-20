import { describe, expect, it } from "vitest";
import { policy } from "../learning-fixtures.test-support";
import type { LearningPolicy } from "./learning-policy";
import { LearningPolicyRegistry } from "./learning-policy-registry";

describe("LearningPolicyRegistry", () => {
  it("registers and resolves policies immutably", () => { const empty = LearningPolicyRegistry.empty(), registry = empty.register(policy); expect(empty.size).toBe(0); expect(registry.require("historical-calibration")).toBe(policy); expect([...registry]).toEqual([policy]); });
  it("rejects duplicate and invalid policies", () => { expect(() => LearningPolicyRegistry.create([policy, policy])).toThrow("Learning policy names must be unique."); expect(() => LearningPolicyRegistry.create([{ name: "invalid" } as LearningPolicy])).toThrow('Learning policy "invalid" is invalid.'); });
});
