import {
  AcquisitionRecommendation,
  AcquisitionType,
  ConfidenceLevel,
  EvidenceDirection,
  EvidenceType,
  MarketTrend,
  PropertyType,
  RiskSeverity,
} from "../../../domain/enums";

import type {
  InvestmentDecision,
} from "../../../domain/investment-decision";

export function createInvestmentDecision():
  InvestmentDecision {
  return {
    acquisitionType:
      AcquisitionType.Purchase,

    property: {
      id: "property-001",
      location: {
        address1:
          "123 Main Street",
        city: "Mesa",
        state: "AZ",
        postalCode: "85201",
      },
      purchasePrice: {
        amount: 400000,
        currency: "USD",
      },
      closingCosts: {
        amount: 12000,
        currency: "USD",
      },
      furnishingBudget: {
        amount: 25000,
        currency: "USD",
      },
      propertyType:
        PropertyType.SingleFamily,
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1800,
      yearBuilt: 2018,
      hoa: {
        amount: 0,
        currency: "USD",
      },
    },

    market: {
      market: "Mesa, AZ",
      submarket: "Downtown Mesa",
      medianAdr: {
        amount: 185,
        currency: "USD",
      },
      medianOccupancy: {
        value: 68,
      },
      trend: MarketTrend.Growing,
      supplyGrowth: {
        value: 4,
      },
      demandGrowth: {
        value: 7,
      },
      seasonality:
        "Strong winter and spring demand.",
    },

    assumptions: {
      downPayment: {
        value: 20,
      },
      interestRate: {
        value: 6.5,
      },
      loanTermYears: 30,
      averageLengthOfStay: 3,
      managementFee: {
        value: 18,
      },
      maintenanceReserve: {
        value: 5,
      },
      capitalReserve: {
        value: 3,
      },
      estimatedUtilities: {
        amount: 3600,
        currency: "USD",
      },
      estimatedInsurance: {
        amount: 1800,
        currency: "USD",
      },
      estimatedTaxes: {
        amount: 3200,
        currency: "USD",
      },
    },

    revenueProjection: {
      projectedAdr: {
        amount: 195,
        currency: "USD",
      },
      projectedOccupancy: {
        value: 70,
      },
      projectedMonthlyRevenue: {
        amount: 4151,
        currency: "USD",
      },
      projectedAnnualRevenue: {
        amount: 49812,
        currency: "USD",
      },
      confidence: {
        value: 82,
      },
    },

    expenseProjection: {
      mortgage: {
        amount: 24272,
        currency: "USD",
      },
      cleaning: {
        amount: 4200,
        currency: "USD",
      },
      utilities: {
        amount: 3600,
        currency: "USD",
      },
      insurance: {
        amount: 1800,
        currency: "USD",
      },
      taxes: {
        amount: 3200,
        currency: "USD",
      },
      management: {
        amount: 8966,
        currency: "USD",
      },
      maintenance: {
        amount: 2491,
        currency: "USD",
      },
      software: {
        amount: 1200,
        currency: "USD",
      },
      supplies: {
        amount: 1500,
        currency: "USD",
      },
      capitalReserve: {
        amount: 1494,
        currency: "USD",
      },
      totalOperatingExpenses: {
        amount: 28451,
        currency: "USD",
      },
      confidence: {
        value: 80,
      },
    },

    financialPerformance: {
      netOperatingIncome: {
        amount: 21361,
        currency: "USD",
      },
      annualCashFlow: {
        amount: 7089,
        currency: "USD",
      },
      capRate: {
        value: 5.34,
      },
      cashOnCashReturn: {
        value: 6.07,
      },
      debtServiceCoverageRatio: 1.49,
      breakEvenOccupancy: {
        value: 55,
      },
    },

    comparableAnalysis: {
      comparables: [],
      medianAverageDailyRate: {
        amount: 190,
        currency: "USD",
      },
      medianOccupancy: {
        value: 69,
      },
      marketPositionScore: {
        value: 76,
        max: 100,
      },
      projectedRevenueUpside: {
        amount: 4300,
        currency: "USD",
      },
      competitiveAdvantages: [
        "Near Downtown Mesa",
      ],
      competitiveDisadvantages: [
        "Seasonal demand concentration",
      ],
      confidence:
        ConfidenceLevel.High,
    },

    score: {
      overall: {
        value: 78,
        max: 100,
      },
      revenuePotential: {
        value: 82,
        max: 100,
      },
      financialStrength: {
        value: 74,
        max: 100,
      },
      marketStrength: {
        value: 80,
        max: 100,
      },
      competitivePosition: {
        value: 76,
        max: 100,
      },
      riskExposure: {
        value: 68,
        max: 100,
      },
    },

    risks: [
      {
        id: "risk-001",
        title:
          "Seasonal revenue concentration",
        description:
          "Revenue is concentrated in winter and spring.",
        severity:
          RiskSeverity.Medium,
        probability: {
          value: 70,
        },
        estimatedFinancialImpact: {
          amount: 6000,
          currency: "USD",
        },
        mitigation:
          "Use monthly pricing and extended-stay campaigns.",
      },
    ],

    supportingEvidence: [
      {
        id: "evidence-001",
        type:
          EvidenceType.MarketTrend,
        direction:
          EvidenceDirection.Positive,
        title:
          "Demand growth exceeds supply growth",
        description:
          "Demand growth is estimated above supply growth.",
        source:
          "Market Intelligence",
        confidence:
          ConfidenceLevel.High,
      },
    ],

    recommendation:
      AcquisitionRecommendation.BuyWithConditions,

    confidence:
      ConfidenceLevel.High,

    strategy: {
      targetOfferPrice: {
        amount: 385000,
        currency: "USD",
      },
      maximumPurchasePrice: {
        amount: 400000,
        currency: "USD",
      },
      walkAwayPrice: {
        amount: 405000,
        currency: "USD",
      },
      requiredAverageDailyRate: {
        amount: 185,
        currency: "USD",
      },
      requiredOccupancy: {
        value: 64,
      },
      requiredAnnualRevenue: {
        amount: 45500,
        currency: "USD",
      },
      requiredNetOperatingIncome: {
        amount: 19500,
        currency: "USD",
      },
      expectedAnnualUpside: {
        amount: 4300,
        currency: "USD",
      },
      primaryOpportunity:
        "Improve shoulder-season occupancy.",
      primaryRisk:
        "Acquisition price leaves limited downside protection.",
      firstNinetyDayPriorities: [
        "Launch dynamic pricing.",
        "Build a direct-booking foundation.",
      ],
    },
  };
}
