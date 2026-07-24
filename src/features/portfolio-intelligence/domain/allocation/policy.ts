import { Money, Percentage } from "@/platform/kernel";
import { Weight } from "@/platform/scoring";

import { CAPITAL_ALLOCATION_DIMENSIONS, type CapitalAllocationDimension, type CapitalAllocationPolicyVersion, type CapitalAllocationPriorityClass } from "./contracts";

export type PortfolioLiquidityPolicy = Readonly<{
  minimumReserveType: "fixed" | "percentage-of-operating-cost" | "months-of-operating-cost" | "strategy-defined";
  minimumReserveValue: Money | Percentage | number;
  warningCoverageThreshold: Percentage;
  criticalCoverageThreshold: Percentage;
  allowReserveBreach: boolean;
}>;
export type CapitalAllocationFeasibilityPolicy = Readonly<{
  staleAfterDays: number;
  conditionalReserveCoverage: Percentage;
  prohibitDiscretionaryWhenMandatoryUnfunded: boolean;
}>;
export type CapitalAllocationConfidencePolicy = Readonly<{
  healthWeight: Weight; capitalWeight: Weight; candidateWeight: Weight; freshnessWeight: Weight;
  estimatedRequirementPenalty: number; unknownImpactPenalty: number; staleSourcePenalty: number;
}>;
export type CapitalAllocationRankingPolicy = Readonly<{
  alternateLimit: number; candidateLimit: number; findingLimit: number; tradeOffLimit: number; dataGapLimit: number;
}>;
export type CapitalAllocationOverridePolicy = Readonly<{
  code: "MANDATORY_UNFUNDED" | "RESERVE_CRITICAL" | "CRITICAL_HEALTH_WORSENED";
  posture: "defer" | "reject"; maximumScore?: number;
}>;
export type CapitalAllocationPolicy = Readonly<{
  version: CapitalAllocationPolicyVersion;
  priorityOrder: readonly CapitalAllocationPriorityClass[];
  discretionaryWeights: Readonly<Record<CapitalAllocationDimension, Weight>>;
  liquidity: PortfolioLiquidityPolicy;
  feasibility: CapitalAllocationFeasibilityPolicy;
  confidence: CapitalAllocationConfidencePolicy;
  ranking: CapitalAllocationRankingPolicy;
  overrides: readonly CapitalAllocationOverridePolicy[];
}>;

export function createCapitalAllocationPolicy(input: CapitalAllocationPolicy): CapitalAllocationPolicy {
  if (!/^capital-allocation-\d+$/.test(input.version)) throw new TypeError("Capital allocation policy version is invalid.");
  if (Object.keys(input.discretionaryWeights).sort().join("|") !== [...CAPITAL_ALLOCATION_DIMENSIONS].sort().join("|")) throw new RangeError("Every allocation dimension must be defined exactly once.");
  const total = CAPITAL_ALLOCATION_DIMENSIONS.reduce((sum, dimension) => sum + input.discretionaryWeights[dimension].ratio, 0);
  if (Math.abs(total - 1) > 1e-10) throw new RangeError("Allocation dimension weights must total 100%.");
  const expectedPriority = ["required", "protect", "improve", "grow", "reserve", "defer"];
  if ([...input.priorityOrder].sort().join("|") !== [...expectedPriority].sort().join("|")) throw new RangeError("Allocation priority order must contain every priority class exactly once.");
  if (input.liquidity.minimumReserveType !== "fixed" || !(input.liquidity.minimumReserveValue instanceof Money)) throw new RangeError("V1 allocation policy supports only a fixed Money reserve.");
  if (input.liquidity.criticalCoverageThreshold.value >= input.liquidity.warningCoverageThreshold.value) throw new RangeError("Critical reserve coverage must be below warning coverage.");
  if (input.feasibility.staleAfterDays < 0 || Object.values(input.ranking).some((value) => !Number.isInteger(value) || value < 1)) throw new RangeError("Allocation policy thresholds and bounds are invalid.");
  return Object.freeze({
    ...input,
    priorityOrder: Object.freeze([...input.priorityOrder]),
    discretionaryWeights: Object.freeze({ ...input.discretionaryWeights }),
    liquidity: Object.freeze({ ...input.liquidity }),
    feasibility: Object.freeze({ ...input.feasibility }),
    confidence: Object.freeze({ ...input.confidence }),
    ranking: Object.freeze({ ...input.ranking }),
    overrides: Object.freeze(input.overrides.map((value) => Object.freeze({ ...value }))),
  });
}

export const CAPITAL_ALLOCATION_POLICY_V1 = createCapitalAllocationPolicy({
  version: "capital-allocation-1",
  priorityOrder: ["required", "protect", "improve", "grow", "reserve", "defer"],
  discretionaryWeights: {
    "portfolio-health-impact": Weight.fromPercentage(25),
    "financial-efficiency": Weight.fromPercentage(20),
    "strategic-alignment": Weight.fromPercentage(15),
    "risk-adjustment": Weight.fromPercentage(15),
    "diversification-impact": Weight.fromPercentage(10),
    "liquidity-impact": Weight.fromPercentage(10),
    timing: Weight.fromPercentage(5),
  },
  liquidity: {
    minimumReserveType: "fixed",
    minimumReserveValue: Money.zero(),
    warningCoverageThreshold: Percentage.create(100),
    criticalCoverageThreshold: Percentage.create(75),
    allowReserveBreach: false,
  },
  feasibility: {
    staleAfterDays: 90,
    conditionalReserveCoverage: Percentage.create(95),
    prohibitDiscretionaryWhenMandatoryUnfunded: true,
  },
  confidence: {
    healthWeight: Weight.fromPercentage(30),
    capitalWeight: Weight.fromPercentage(30),
    candidateWeight: Weight.fromPercentage(30),
    freshnessWeight: Weight.fromPercentage(10),
    estimatedRequirementPenalty: 10,
    unknownImpactPenalty: 10,
    staleSourcePenalty: 20,
  },
  ranking: { alternateLimit: 3, candidateLimit: 100, findingLimit: 50, tradeOffLimit: 20, dataGapLimit: 100 },
  overrides: [
    { code: "MANDATORY_UNFUNDED", posture: "reject", maximumScore: 0 },
    { code: "RESERVE_CRITICAL", posture: "defer", maximumScore: 40 },
    { code: "CRITICAL_HEALTH_WORSENED", posture: "reject", maximumScore: 0 },
  ],
});
