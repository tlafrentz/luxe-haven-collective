import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionType,
  MarketTrend,
  PropertyType,
} from "../../domain";

import {
  runInvestmentAnalysis,
} from "../run-investment-analysis";

import type {
  RunPurchaseInvestmentAnalysisCommand,
} from "../run-investment-analysis";

import {
  buildPurchaseDecisionEvidence,
} from "./builders/build-purchase-decision-evidence";

import {
  buildPurchaseDecisionRisks,
} from "./builders/build-purchase-decision-risks";

import {
  buildPurchaseInvestmentRecommendation,
} from "./builders/build-purchase-investment-recommendation";

import {
  buildPurchaseInvestmentThesis,
} from "./builders/build-purchase-investment-thesis";

import {
  calculatePurchaseDecisionConfidence,
} from "./builders/calculate-purchase-decision-confidence";

const baseCommand = {
  acquisitionType:
    AcquisitionType.Purchase,
  property: {
    id: "characterization-purchase",
    address1: "123 Main Street",
    city: "Mesa",
    state: "AZ",
    postalCode: "85201",
    purchasePrice: 400000,
    closingCosts: 12000,
    furnishingBudget: 18000,
    propertyType:
      PropertyType.Apartment,
    bedrooms: 2,
    bathrooms: 1,
    squareFeet: 950,
  },
  financing: {
    downPaymentPercentage: 20,
    interestRatePercentage: 6.5,
    loanTermYears: 30,
  },
  revenue: {
    projectedAdr: 200,
    projectedOccupancyPercentage: 75,
    averageLengthOfStay: 4,
    confidencePercentage: 85,
  },
  operating: {
    managementFeePercentage: 10,
    monthlyUtilities: 250,
    annualInsurance: 1500,
    annualTaxes: 3500,
    annualCleaning: 6000,
    annualSoftware: 500,
    annualSupplies: 1000,
    maintenanceReservePercentage: 4,
    capitalReservePercentage: 2,
  },
  market: {
    name: "Mesa",
    submarket: "Downtown Mesa",
    medianAdr: 180,
    medianOccupancyPercentage: 70,
    trend: MarketTrend.Stable,
  },
  comparables: [
    {
      id: "comparable-1",
      distanceMiles: 0.8,
      bedrooms: 2,
      bathrooms: 1,
      averageDailyRate: {
        amount: 180,
        currency: "USD",
      },
      occupancy: { value: 70 },
      rating: { value: 4.8, max: 5 },
      reviewCount: 120,
      amenities: ["Kitchen"],
    },
    {
      id: "comparable-2",
      distanceMiles: 1.2,
      bedrooms: 2,
      bathrooms: 1,
      averageDailyRate: {
        amount: 190,
        currency: "USD",
      },
      occupancy: { value: 72 },
      rating: { value: 4.7, max: 5 },
      reviewCount: 85,
      amenities: ["Workspace"],
    },
    {
      id: "comparable-3",
      distanceMiles: 1.4,
      bedrooms: 2,
      bathrooms: 1,
      averageDailyRate: {
        amount: 185,
        currency: "USD",
      },
      occupancy: { value: 71 },
      rating: { value: 4.6, max: 5 },
      reviewCount: 70,
      amenities: ["Parking"],
    },
    {
      id: "comparable-4",
      distanceMiles: 1.6,
      bedrooms: 2,
      bathrooms: 1,
      averageDailyRate: {
        amount: 175,
        currency: "USD",
      },
      occupancy: { value: 68 },
      rating: { value: 4.9, max: 5 },
      reviewCount: 140,
      amenities: ["Laundry"],
    },
    {
      id: "comparable-5",
      distanceMiles: 1.8,
      bedrooms: 2,
      bathrooms: 1,
      averageDailyRate: {
        amount: 195,
        currency: "USD",
      },
      occupancy: { value: 73 },
      rating: { value: 4.7, max: 5 },
      reviewCount: 95,
      amenities: ["Kitchen"],
    },
  ],
} as const satisfies
  RunPurchaseInvestmentAnalysisCommand;

const fixtures: readonly {
  name: string;
  command:
    RunPurchaseInvestmentAnalysisCommand;
}[] = [
  {
    name: "strong acquisition",
    command: {
      ...baseCommand,
      property: {
        ...baseCommand.property,
        purchasePrice: 250000,
      },
      financing: {
        ...baseCommand.financing,
        downPaymentPercentage: 30,
      },
      revenue: {
        ...baseCommand.revenue,
        projectedAdr: 240,
        projectedOccupancyPercentage: 80,
      },
    },
  },
  {
    name: "marginal acquisition",
    command: baseCommand,
  },
  {
    name: "weak acquisition",
    command: {
      ...baseCommand,
      property: {
        ...baseCommand.property,
        purchasePrice: 550000,
      },
      revenue: {
        ...baseCommand.revenue,
        projectedAdr: 160,
        projectedOccupancyPercentage: 55,
      },
    },
  },
  {
    name: "negative cash flow",
    command: {
      ...baseCommand,
      revenue: {
        ...baseCommand.revenue,
        projectedAdr: 160,
        projectedOccupancyPercentage: 50,
      },
    },
  },
  {
    name: "high leverage",
    command: {
      ...baseCommand,
      financing: {
        ...baseCommand.financing,
        downPaymentPercentage: 5,
      },
    },
  },
  {
    name: "low occupancy",
    command: {
      ...baseCommand,
      revenue: {
        ...baseCommand.revenue,
        projectedOccupancyPercentage: 45,
      },
    },
  },
  {
    name: "weak comparable confidence",
    command: {
      ...baseCommand,
      comparables: [
        baseCommand.comparables[0],
      ],
    },
  },
];

describe(
  "purchase decision pipeline characterization",
  () => {
    it("records the canonical and legacy policy outputs across representative purchases", () => {
      const observed = fixtures.map(
        ({ name, command }) => {
          const result =
            runInvestmentAnalysis(command);

          if (
            result.acquisitionType !==
            AcquisitionType.Purchase
          ) {
            throw new Error(
              "Expected purchase result.",
            );
          }

          const { analysis, derivedAnalysis } =
            result;
          const legacyEvidence =
            buildPurchaseDecisionEvidence({
              analysis,
              ...derivedAnalysis,
            });
          const legacyRisks =
            buildPurchaseDecisionRisks({
              analysis,
              ...derivedAnalysis,
            });
          const legacyConfidence =
            calculatePurchaseDecisionConfidence({
              analysis,
              ...derivedAnalysis,
            });
          const legacyRecommendation =
            buildPurchaseInvestmentRecommendation({
              analysis,
              ...derivedAnalysis,
              evidence: legacyEvidence,
              risks: legacyRisks,
              confidence: legacyConfidence,
            });
          const legacyThesis =
            buildPurchaseInvestmentThesis({
              analysis,
              evidence: legacyEvidence,
              risks: legacyRisks,
            });

          return {
            name,
            canonical: {
              riskCodes:
                analysis.risks.map(
                  ({ id, severity }) =>
                    `${id}:${severity}`,
                ),
              evidence:
                analysis.supportingEvidence.map(
                  ({ type, direction }) =>
                    `${type}:${direction}`,
                ),
              score: {
                overall:
                  analysis.score.overall.value,
                revenue:
                  analysis.score
                    .revenuePotential.value,
                financial:
                  analysis.score
                    .financialStrength.value,
                market:
                  analysis.score
                    .marketStrength.value,
                competitive:
                  analysis.score
                    .competitivePosition.value,
                risk:
                  analysis.score.riskExposure
                    .value,
              },
              confidence:
                analysis.confidence,
              recommendation:
                analysis.recommendation,
            },
            legacy: {
              riskCodes:
                legacyRisks.map(
                  ({ code, severity }) =>
                    `${code}:${severity}`,
                ),
              evidence:
                legacyEvidence.map(
                  ({ category, positive }) =>
                    `${category}:${positive ? "positive" : "caution"}`,
                ),
              score: null,
              confidence: {
                score: legacyConfidence.score,
                level: legacyConfidence.level,
              },
              recommendation:
                legacyRecommendation
                  .recommendation,
              thesis: legacyThesis.headline,
            },
          };
        },
      );

      expect(observed).toMatchInlineSnapshot(`
        [
          {
            "canonical": {
              "confidence": "moderate",
              "evidence": [
                "financial-model:positive",
                "financial-model:positive",
                "financial-model:positive",
                "financial-model:positive",
                "revenue-projection:positive",
                "comparable:positive",
                "comparable:positive",
                "financial-model:caution",
              ],
              "recommendation": "buy",
              "riskCodes": [
                "aggressive-adr-assumption:medium",
              ],
              "score": {
                "competitive": 61,
                "financial": 93,
                "market": 91,
                "overall": 79,
                "revenue": 68,
                "risk": 33,
              },
            },
            "legacy": {
              "confidence": {
                "level": "very-high",
                "score": 91,
              },
              "evidence": [
                "financial:positive",
                "financial:positive",
                "financial:positive",
                "resilience:positive",
                "resilience:positive",
                "financing:positive",
              ],
              "recommendation": "strong-buy",
              "riskCodes": [],
              "score": null,
              "thesis": "Positive economics with a defensible debt-service cushion",
            },
            "name": "strong acquisition",
          },
          {
            "canonical": {
              "confidence": "moderate",
              "evidence": [
                "revenue-projection:positive",
                "comparable:positive",
                "financial-model:caution",
              ],
              "recommendation": "buy-with-conditions",
              "riskCodes": [
                "elevated-break-even-occupancy:medium",
              ],
              "score": {
                "competitive": 53,
                "financial": 69,
                "market": 91,
                "overall": 69,
                "revenue": 59,
                "risk": 28,
              },
            },
            "legacy": {
              "confidence": {
                "level": "medium",
                "score": 63,
              },
              "evidence": [
                "financial:positive",
                "financial:positive",
                "financial:caution",
                "resilience:caution",
                "resilience:caution",
                "financing:positive",
              ],
              "recommendation": "buy-with-conditions",
              "riskCodes": [
                "occupancy-sensitivity:medium",
                "downside-loss:high",
              ],
              "score": null,
              "thesis": "Positive economics with a defensible debt-service cushion",
            },
            "name": "marginal acquisition",
          },
          {
            "canonical": {
              "confidence": "moderate",
              "evidence": [
                "financial-model:caution",
                "financial-model:caution",
                "financial-model:caution",
                "financial-model:caution",
              ],
              "recommendation": "pass",
              "riskCodes": [
                "negative-annual-cash-flow:critical",
                "insufficient-debt-service-coverage:critical",
                "critical-break-even-occupancy:critical",
                "low-cap-rate:medium",
              ],
              "score": {
                "competitive": 41,
                "financial": 15,
                "market": 91,
                "overall": 41,
                "revenue": 43,
                "risk": 84,
              },
            },
            "legacy": {
              "confidence": {
                "level": "low",
                "score": 46,
              },
              "evidence": [
                "financial:caution",
                "financial:caution",
                "financial:caution",
                "resilience:caution",
                "resilience:caution",
                "financing:caution",
              ],
              "recommendation": "pass",
              "riskCodes": [
                "thin-dscr:critical",
                "occupancy-sensitivity:high",
                "adr-sensitivity:high",
                "downside-loss:high",
                "unsupported-price:critical",
              ],
              "score": null,
              "thesis": "Current underwriting does not support acquisition",
            },
            "name": "weak acquisition",
          },
          {
            "canonical": {
              "confidence": "moderate",
              "evidence": [
                "financial-model:caution",
                "financial-model:caution",
                "financial-model:caution",
                "financial-model:caution",
              ],
              "recommendation": "pass",
              "riskCodes": [
                "negative-annual-cash-flow:critical",
                "insufficient-debt-service-coverage:critical",
                "high-break-even-occupancy:high",
                "low-cap-rate:medium",
              ],
              "score": {
                "competitive": 39,
                "financial": 18,
                "market": 91,
                "overall": 42,
                "revenue": 41,
                "risk": 77,
              },
            },
            "legacy": {
              "confidence": {
                "level": "low",
                "score": 46,
              },
              "evidence": [
                "financial:caution",
                "financial:caution",
                "financial:caution",
                "resilience:caution",
                "resilience:caution",
                "financing:caution",
              ],
              "recommendation": "pass",
              "riskCodes": [
                "thin-dscr:critical",
                "occupancy-sensitivity:high",
                "adr-sensitivity:high",
                "downside-loss:high",
                "unsupported-price:critical",
              ],
              "score": null,
              "thesis": "Current underwriting does not support acquisition",
            },
            "name": "negative cash flow",
          },
          {
            "canonical": {
              "confidence": "moderate",
              "evidence": [
                "revenue-projection:positive",
                "comparable:positive",
                "financial-model:caution",
                "financial-model:caution",
              ],
              "recommendation": "buy-with-conditions",
              "riskCodes": [
                "limited-debt-service-buffer:high",
                "high-break-even-occupancy:high",
              ],
              "score": {
                "competitive": 53,
                "financial": 59,
                "market": 91,
                "overall": 63,
                "revenue": 59,
                "risk": 57,
              },
            },
            "legacy": {
              "confidence": {
                "level": "low",
                "score": 50,
              },
              "evidence": [
                "financial:positive",
                "financial:caution",
                "financial:caution",
                "resilience:caution",
                "resilience:caution",
                "financing:positive",
              ],
              "recommendation": "wait",
              "riskCodes": [
                "thin-dscr:high",
                "occupancy-sensitivity:high",
                "adr-sensitivity:high",
                "downside-loss:high",
              ],
              "score": null,
              "thesis": "Positive cash flow with limited downside protection",
            },
            "name": "high leverage",
          },
          {
            "canonical": {
              "confidence": "moderate",
              "evidence": [
                "comparable:positive",
                "financial-model:caution",
                "financial-model:caution",
                "financial-model:caution",
                "financial-model:caution",
              ],
              "recommendation": "pass",
              "riskCodes": [
                "negative-annual-cash-flow:critical",
                "insufficient-debt-service-coverage:critical",
                "elevated-break-even-occupancy:medium",
                "low-cap-rate:medium",
              ],
              "score": {
                "competitive": 43,
                "financial": 25,
                "market": 91,
                "overall": 46,
                "revenue": 44,
                "risk": 71,
              },
            },
            "legacy": {
              "confidence": {
                "level": "low",
                "score": 46,
              },
              "evidence": [
                "financial:caution",
                "financial:caution",
                "financial:caution",
                "resilience:caution",
                "resilience:caution",
                "financing:caution",
              ],
              "recommendation": "pass",
              "riskCodes": [
                "thin-dscr:critical",
                "occupancy-sensitivity:high",
                "adr-sensitivity:high",
                "downside-loss:high",
                "unsupported-price:critical",
              ],
              "score": null,
              "thesis": "Current underwriting does not support acquisition",
            },
            "name": "low occupancy",
          },
          {
            "canonical": {
              "confidence": "low",
              "evidence": [
                "revenue-projection:positive",
                "comparable:positive",
                "comparable:positive",
                "financial-model:caution",
                "financial-model:caution",
              ],
              "recommendation": "wait",
              "riskCodes": [
                "elevated-break-even-occupancy:medium",
                "limited-comparable-confidence:medium",
              ],
              "score": {
                "competitive": 55,
                "financial": 69,
                "market": 82,
                "overall": 67,
                "revenue": 62,
                "risk": 37,
              },
            },
            "legacy": {
              "confidence": {
                "level": "medium",
                "score": 63,
              },
              "evidence": [
                "financial:positive",
                "financial:positive",
                "financial:caution",
                "resilience:caution",
                "resilience:caution",
                "financing:positive",
              ],
              "recommendation": "buy-with-conditions",
              "riskCodes": [
                "occupancy-sensitivity:medium",
                "downside-loss:high",
              ],
              "score": null,
              "thesis": "Positive economics with a defensible debt-service cushion",
            },
            "name": "weak comparable confidence",
          },
        ]
      `);
    });
  },
);
