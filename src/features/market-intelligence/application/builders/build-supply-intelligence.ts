import { SupplyIntelligence } from "../../domain/entities/supply-intelligence";
import { ConfidenceScore } from "../../domain/value-objects/confidence-score";
import { MarketScore } from "../../domain/value-objects/market-score";
import {
  clampScore,
  weightedAverage,
} from "./helpers/number-utils";

export interface BuildSupplyIntelligenceInput {
  readonly activeListingCount?: number;
  readonly professionalOperatorSharePercent?: number;
  readonly luxuryInventorySharePercent?: number;
  readonly inventoryGrowthPercent?: number;
  readonly saturationScore?: number;
  readonly supplyScore?: number;
  readonly confidenceScore: number;
  readonly opportunities?: readonly string[];
  readonly risks?: readonly string[];
  readonly missingInformation?: readonly string[];
}

export function buildSupplyIntelligence(
  input: BuildSupplyIntelligenceInput,
): SupplyIntelligence {
  const missingInformation =
    input.missingInformation ??
    deriveMissingInformation(input);

  const saturationScore = MarketScore.create(
    input.saturationScore ??
      calculateSaturationScore(input),
  );

  const supplyScore = MarketScore.create(
    input.supplyScore ??
      calculateSupplyScore(input, saturationScore.value),
  );

  const opportunities =
    input.opportunities ??
    deriveOpportunities(input, saturationScore.value);

  const risks =
    input.risks ??
    deriveRisks(input, saturationScore.value);

  return SupplyIntelligence.create({
    activeListingCount: input.activeListingCount,
    professionalOperatorSharePercent:
      input.professionalOperatorSharePercent,
    luxuryInventorySharePercent:
      input.luxuryInventorySharePercent,
    inventoryGrowthPercent: input.inventoryGrowthPercent,
    saturationScore,
    competitionRating: saturationScore.rating,
    supplyScore,
    confidence: new ConfidenceScore(input.confidenceScore),
    opportunities,
    risks,
    missingInformation,
    executiveSummary: buildExecutiveSummary({
      input,
      saturationScore: saturationScore.value,
      supplyScore: supplyScore.value,
      opportunities,
      risks,
      missingInformation,
    }),
  });
}

function calculateSaturationScore(
  input: BuildSupplyIntelligenceInput,
): number {
  const listingPressure =
    input.activeListingCount === undefined
      ? undefined
      : scoreActiveListingPressure(input.activeListingCount);

  const professionalPressure =
    input.professionalOperatorSharePercent;

  const growthPressure =
    input.inventoryGrowthPercent === undefined
      ? undefined
      : clampScore(50 + input.inventoryGrowthPercent * 2.5);

  return clampScore(
    weightedAverage([
      { value: listingPressure, weight: 0.25 },
      { value: professionalPressure, weight: 0.35 },
      { value: growthPressure, weight: 0.4 },
    ]) ?? 50,
  );
}

function calculateSupplyScore(
  input: BuildSupplyIntelligenceInput,
  saturationScore: number,
): number {
  const inventoryStability =
    input.inventoryGrowthPercent === undefined
      ? undefined
      : clampScore(70 - Math.max(0, input.inventoryGrowthPercent) * 2);

  const accessibleCompetition = 100 - saturationScore;

  const luxuryWhitespace =
    input.luxuryInventorySharePercent === undefined
      ? undefined
      : clampScore(100 - input.luxuryInventorySharePercent);

  return clampScore(
    weightedAverage([
      { value: accessibleCompetition, weight: 0.5 },
      { value: inventoryStability, weight: 0.3 },
      { value: luxuryWhitespace, weight: 0.2 },
    ]) ?? accessibleCompetition,
  );
}

function deriveOpportunities(
  input: BuildSupplyIntelligenceInput,
  saturationScore: number,
): readonly string[] {
  const opportunities: string[] = [];

  if (saturationScore < 45) {
    opportunities.push(
      "Competitive saturation remains low enough to support differentiated entry.",
    );
  }

  if (
    input.luxuryInventorySharePercent !== undefined &&
    input.luxuryInventorySharePercent < 20
  ) {
    opportunities.push(
      "Limited luxury inventory may create room for a premium-positioned property.",
    );
  }

  if (
    input.professionalOperatorSharePercent !== undefined &&
    input.professionalOperatorSharePercent < 35
  ) {
    opportunities.push(
      "A fragmented operator base may reward disciplined revenue and operating execution.",
    );
  }

  if (
    input.inventoryGrowthPercent !== undefined &&
    input.inventoryGrowthPercent <= 2
  ) {
    opportunities.push(
      "Controlled inventory growth reduces near-term supply pressure.",
    );
  }

  return opportunities;
}

function deriveRisks(
  input: BuildSupplyIntelligenceInput,
  saturationScore: number,
): readonly string[] {
  const risks: string[] = [];

  if (saturationScore >= 70) {
    risks.push(
      "High market saturation creates material competitive pressure.",
    );
  }

  if (
    input.inventoryGrowthPercent !== undefined &&
    input.inventoryGrowthPercent >= 10
  ) {
    risks.push(
      "Rapid inventory growth may pressure occupancy and pricing power.",
    );
  }

  if (
    input.professionalOperatorSharePercent !== undefined &&
    input.professionalOperatorSharePercent >= 60
  ) {
    risks.push(
      "A high professional-operator share raises the execution standard for new entrants.",
    );
  }

  if (
    input.luxuryInventorySharePercent !== undefined &&
    input.luxuryInventorySharePercent >= 40
  ) {
    risks.push(
      "A large luxury inventory share increases competition for premium demand.",
    );
  }

  return risks;
}

function deriveMissingInformation(
  input: BuildSupplyIntelligenceInput,
): readonly string[] {
  const missing: string[] = [];

  if (input.activeListingCount === undefined) {
    missing.push("Active listing count");
  }

  if (input.professionalOperatorSharePercent === undefined) {
    missing.push("Professional operator share");
  }

  if (input.luxuryInventorySharePercent === undefined) {
    missing.push("Luxury inventory share");
  }

  if (input.inventoryGrowthPercent === undefined) {
    missing.push("Inventory growth");
  }

  return missing;
}

function buildExecutiveSummary({
  input,
  saturationScore,
  supplyScore,
  opportunities,
  risks,
  missingInformation,
}: {
  readonly input: BuildSupplyIntelligenceInput;
  readonly saturationScore: number;
  readonly supplyScore: number;
  readonly opportunities: readonly string[];
  readonly risks: readonly string[];
  readonly missingInformation: readonly string[];
}): string {
  const inventoryStatement =
    input.activeListingCount === undefined
      ? "Active inventory volume is not yet known."
      : `The market contains ${input.activeListingCount.toLocaleString()} active listings.`;

  const growthStatement =
    input.inventoryGrowthPercent === undefined
      ? "Inventory growth remains unverified."
      : `Inventory is changing at ${input.inventoryGrowthPercent}% over the measured period.`;

  return `${inventoryStatement} Supply attractiveness scores ${supplyScore}, while competitive saturation scores ${saturationScore}. ${growthStatement} ${opportunities.length} ${
    opportunities.length === 1 ? "opportunity was" : "opportunities were"
  } identified alongside ${risks.length} material ${
    risks.length === 1 ? "risk" : "risks"
  }. ${missingInformation.length} ${
    missingInformation.length === 1 ? "data gap remains" : "data gaps remain"
  }.`;
}

function scoreActiveListingPressure(activeListingCount: number): number {
  if (activeListingCount <= 100) {
    return 20;
  }

  if (activeListingCount <= 500) {
    return 40;
  }

  if (activeListingCount <= 1_500) {
    return 60;
  }

  if (activeListingCount <= 5_000) {
    return 80;
  }

  return 95;
}
