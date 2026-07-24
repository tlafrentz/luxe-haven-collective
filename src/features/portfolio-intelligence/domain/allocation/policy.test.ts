import { describe, expect, it } from "vitest";
import { Weight } from "@/platform/scoring";
import { CAPITAL_ALLOCATION_POLICY_V1, createCapitalAllocationPolicy } from "./policy";

describe("Capital allocation policy", () => {
  it("is versioned, immutable, complete, and totals 100%", () => {
    expect(CAPITAL_ALLOCATION_POLICY_V1.version).toBe("capital-allocation-1");
    expect(Object.isFrozen(CAPITAL_ALLOCATION_POLICY_V1)).toBe(true);
    expect(Object.values(CAPITAL_ALLOCATION_POLICY_V1.discretionaryWeights).reduce((sum, weight) => sum + weight.percentage, 0)).toBe(100);
    expect(CAPITAL_ALLOCATION_POLICY_V1.priorityOrder).toEqual(["required", "protect", "improve", "grow", "reserve", "defer"]);
  });
  it("rejects incomplete weights, invalid totals, invalid precedence, and unsupported reserve methods", () => {
    expect(() => createCapitalAllocationPolicy({ ...CAPITAL_ALLOCATION_POLICY_V1, discretionaryWeights: { ...CAPITAL_ALLOCATION_POLICY_V1.discretionaryWeights, timing: Weight.fromPercentage(10) } })).toThrow(/100%/);
    expect(() => createCapitalAllocationPolicy({ ...CAPITAL_ALLOCATION_POLICY_V1, priorityOrder: ["required"] as typeof CAPITAL_ALLOCATION_POLICY_V1.priorityOrder })).toThrow(/priority/);
    expect(() => createCapitalAllocationPolicy({ ...CAPITAL_ALLOCATION_POLICY_V1, liquidity: { ...CAPITAL_ALLOCATION_POLICY_V1.liquidity, minimumReserveType: "months-of-operating-cost", minimumReserveValue: 3 } })).toThrow(/fixed Money/);
  });
});
