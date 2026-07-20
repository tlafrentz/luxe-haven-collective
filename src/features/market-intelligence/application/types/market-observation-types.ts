export const MARKET_OBSERVATION_CAPABILITY =
  "market-intelligence";

export const MARKET_OBSERVATION_TYPES = {
  comparableCount: "market.comparable-count",
  averageSimilarity:
    "market.average-comparable-similarity",
  totalComparableWeight:
    "market.total-comparable-weight",
  weightedEstimatedValue:
    "market.weighted-estimated-value",

  estimatedValue: "market.estimated-value",
  valuationLow: "market.valuation-low",
  valuationHigh: "market.valuation-high",
  valuationSpread: "market.valuation-spread",
  valuationSpreadRatio:
    "market.valuation-spread-ratio",
  valuationConfidence:
    "market.valuation-confidence",
  valuationComparableCount:
    "market.valuation-comparable-count",
  valuationAverageSimilarity:
    "market.valuation-average-similarity",
  valuationDispersionRatio:
    "market.valuation-dispersion-ratio",

  findingStrength:
    "market.finding.strength",
  findingRisk:
    "market.finding.risk",
  findingObservation:
    "market.finding.observation",
  findingDataGap:
    "market.finding.data-gap",

  evidenceSubjectProperty:
    "market.evidence.subject-property",
  evidenceComparableProperty:
    "market.evidence.comparable-property",
  evidenceValuation:
    "market.evidence.valuation",
  evidenceProvider:
    "market.evidence.provider",
  evidenceCalculation:
    "market.evidence.calculation",

  summary: "market.summary",
} as const;

export type MarketObservationType =
  (typeof MARKET_OBSERVATION_TYPES)[
    keyof typeof MARKET_OBSERVATION_TYPES
  ];
