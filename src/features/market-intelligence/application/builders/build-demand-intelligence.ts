import { DemandIntelligence } from "../../domain/entities/demand-intelligence";
import { TrendDirection } from "../../domain/enums/trend-direction";
import { ConfidenceScore } from "../../domain/value-objects/confidence-score";
import { MarketScore } from "../../domain/value-objects/market-score";
import {
  clampScore,
  weightedAverage,
} from "./helpers/number-utils";
import {
  describeTrend,
  isNegativeTrend,
  isPositiveTrend,
} from "./helpers/trend-utils";

export interface BuildDemandIntelligenceInput {
  readonly occupancyPercent?: number;
  readonly averageDailyRate?: number;
  readonly revenuePerAvailableNight?: number;
  readonly bookingPacePercent?: number;
  readonly weekendStrengthScore: number;
  readonly weekdayStrengthScore: number;
  readonly seasonalityStrengthScore: number;
  readonly demandOutlook: TrendDirection;
  readonly demandScore?: number;
  readonly confidenceScore: number;
  readonly strengths?: readonly string[];
  readonly risks?: readonly string[];
  readonly missingInformation?: readonly string[];
}

export function buildDemandIntelligence(
  input: BuildDemandIntelligenceInput,
): DemandIntelligence {
  const weekendStrengthScore = MarketScore.create(
    input.weekendStrengthScore,
  );
  const weekdayStrengthScore = MarketScore.create(
    input.weekdayStrengthScore,
  );
  const seasonalityStrengthScore = MarketScore.create(
    input.seasonalityStrengthScore,
  );

  const demandScore = MarketScore.create(
    input.demandScore ?? calculateDemandScore(input),
  );

  const missingInformation =
    input.missingInformation ??
    deriveMissingInformation(input);

  const strengths =
    input.strengths ??
    deriveStrengths(input, {
      weekend: weekendStrengthScore.value,
      weekday: weekdayStrengthScore.value,
      seasonality: seasonalityStrengthScore.value,
    });

  const risks =
    input.risks ??
    deriveRisks(input, {
      weekend: weekendStrengthScore.value,
      weekday: weekdayStrengthScore.value,
      seasonality: seasonalityStrengthScore.value,
    });

  return DemandIntelligence.create({
    occupancyPercent: input.occupancyPercent,
    averageDailyRate: input.averageDailyRate,
    revenuePerAvailableNight:
      input.revenuePerAvailableNight,
    bookingPacePercent: input.bookingPacePercent,
    weekendStrength: weekendStrengthScore.rating,
    weekdayStrength: weekdayStrengthScore.rating,
    seasonalityStrength: seasonalityStrengthScore.rating,
    demandOutlook: input.demandOutlook,
    demandScore,
    confidence: new ConfidenceScore(input.confidenceScore),
    strengths,
    risks,
    missingInformation,
    executiveSummary: buildExecutiveSummary({
      input,
      demandScore: demandScore.value,
      strengths,
      risks,
      missingInformation,
    }),
  });
}

function calculateDemandScore(
  input: BuildDemandIntelligenceInput,
): number {
  const revParEfficiency =
    input.revenuePerAvailableNight === undefined ||
    input.averageDailyRate === undefined ||
    input.averageDailyRate === 0
      ? undefined
      : clampScore(
          (input.revenuePerAvailableNight /
            input.averageDailyRate) *
            100,
        );

  return clampScore(
    weightedAverage([
      { value: input.occupancyPercent, weight: 0.3 },
      { value: revParEfficiency, weight: 0.15 },
      { value: input.bookingPacePercent, weight: 0.15 },
      { value: input.weekendStrengthScore, weight: 0.15 },
      { value: input.weekdayStrengthScore, weight: 0.15 },
      { value: input.seasonalityStrengthScore, weight: 0.1 },
    ]) ?? 50,
  );
}

function deriveStrengths(
  input: BuildDemandIntelligenceInput,
  scores: {
    readonly weekend: number;
    readonly weekday: number;
    readonly seasonality: number;
  },
): readonly string[] {
  const strengths: string[] = [];

  if (
    input.occupancyPercent !== undefined &&
    input.occupancyPercent >= 65
  ) {
    strengths.push(
      "Occupancy indicates healthy market demand.",
    );
  }

  if (scores.weekend >= 70) {
    strengths.push(
      "Weekend demand provides a strong revenue foundation.",
    );
  }

  if (scores.weekday >= 70) {
    strengths.push(
      "Weekday demand reduces reliance on leisure weekends.",
    );
  }

  if (scores.seasonality >= 70) {
    strengths.push(
      "Demand remains resilient across seasonal periods.",
    );
  }

  if (isPositiveTrend(input.demandOutlook)) {
    strengths.push(
      `The demand outlook is ${describeTrend(input.demandOutlook)}.`,
    );
  }

  return strengths;
}

function deriveRisks(
  input: BuildDemandIntelligenceInput,
  scores: {
    readonly weekend: number;
    readonly weekday: number;
    readonly seasonality: number;
  },
): readonly string[] {
  const risks: string[] = [];

  if (
    input.occupancyPercent !== undefined &&
    input.occupancyPercent < 45
  ) {
    risks.push(
      "Low occupancy indicates weak demand absorption.",
    );
  }

  if (scores.weekday < 40) {
    risks.push(
      "Weak weekday demand increases dependence on weekend performance.",
    );
  }

  if (scores.weekend < 40) {
    risks.push(
      "Weak weekend demand limits peak-period revenue potential.",
    );
  }

  if (scores.seasonality < 40) {
    risks.push(
      "High seasonality may create meaningful low-season revenue exposure.",
    );
  }

  if (isNegativeTrend(input.demandOutlook)) {
    risks.push(
      `The demand outlook is ${describeTrend(input.demandOutlook)}.`,
    );
  }

  return risks;
}

function deriveMissingInformation(
  input: BuildDemandIntelligenceInput,
): readonly string[] {
  const missing: string[] = [];

  if (input.occupancyPercent === undefined) {
    missing.push("Occupancy");
  }

  if (input.averageDailyRate === undefined) {
    missing.push("Average daily rate");
  }

  if (input.revenuePerAvailableNight === undefined) {
    missing.push("Revenue per available night");
  }

  if (input.bookingPacePercent === undefined) {
    missing.push("Booking pace");
  }

  return missing;
}

function buildExecutiveSummary({
  input,
  demandScore,
  strengths,
  risks,
  missingInformation,
}: {
  readonly input: BuildDemandIntelligenceInput;
  readonly demandScore: number;
  readonly strengths: readonly string[];
  readonly risks: readonly string[];
  readonly missingInformation: readonly string[];
}): string {
  const performanceStatement =
    input.occupancyPercent !== undefined &&
    input.averageDailyRate !== undefined &&
    input.revenuePerAvailableNight !== undefined
      ? `The market is producing ${input.occupancyPercent}% occupancy, a ${formatCurrency(
          input.averageDailyRate,
        )} ADR, and ${formatCurrency(
          input.revenuePerAvailableNight,
        )} RevPAR.`
      : "The complete occupancy, ADR, and RevPAR performance set is not yet available.";

  return `${performanceStatement} Overall demand scores ${demandScore}, with a ${describeTrend(
    input.demandOutlook,
  )} outlook. ${strengths.length} demand ${
    strengths.length === 1 ? "strength was" : "strengths were"
  } identified alongside ${risks.length} material ${
    risks.length === 1 ? "risk" : "risks"
  }. ${missingInformation.length} ${
    missingInformation.length === 1 ? "data gap remains" : "data gaps remain"
  }.`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
