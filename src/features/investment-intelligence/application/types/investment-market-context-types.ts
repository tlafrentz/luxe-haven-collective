import type { MarketAnalysisReport } from "@/features/market-intelligence";

export type InvestmentMarketContextStatus =
  | "available"
  | "limited"
  | "insufficient"
  | "unsupported";

export type InvestmentMarketEvidenceUsabilityLevel =
  | "usable"
  | "usable-with-caution"
  | "unusable";

export type InvestmentMarketValuationProjection = Readonly<{
  status: "estimated" | "limited" | "insufficient" | "unsupported";
  estimatedValue?: number;
  valueRange?: Readonly<{ lower: number; upper: number }>;
  comparableCount: number;
  confidenceScore: number;
  source: "market-analysis";
}>;

export type InvestmentMarketRentProjection = Readonly<{
  status: "estimated" | "limited" | "insufficient" | "unsupported";
  estimatedMonthlyRent?: number;
  rentRange?: Readonly<{ lower: number; upper: number }>;
  comparableCount: number;
  confidenceScore: number;
  source: "market-analysis";
}>;

export type InvestmentMarketConfidenceProjection = Readonly<{
  score: number;
  level: "high" | "medium" | "low" | "none";
  reasons: readonly string[];
}>;

export type InvestmentMarketRiskProjection = Readonly<{
  id: string;
  marketRiskCode: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  sourceEvidenceIds: readonly string[];
  sourceDataGapIds: readonly string[];
  marketAnalysisId: string;
}>;

export type InvestmentMarketDataGapProjection = Readonly<{
  id: string;
  code: string;
  severity: "informational" | "material" | "blocking";
  affectedInvestmentAssumptionKeys: readonly string[];
  sourceStage: string;
  sourceMarketAnalysisId: string;
}>;

export type InvestmentMarketEvidenceReference = Readonly<{
  evidenceId: string;
  type: string;
  description: string;
  candidateIds: readonly string[];
}>;

export type InvestmentMarketContextLineage = Readonly<{
  marketAnalysisId: string;
  propertyResolutionId: string;
  policyVersion: string;
  observationIds: readonly string[];
  evidenceIds: readonly string[];
  saleAcquisitionId?: string;
  saleQualificationId?: string;
  rentalAcquisitionId?: string;
  rentalQualificationId?: string;
}>;

export type InvestmentMarketContext = Readonly<{
  marketAnalysisId: string;
  subjectId: string;
  status: InvestmentMarketContextStatus;
  saleValuation?: InvestmentMarketValuationProjection;
  longTermRent?: InvestmentMarketRentProjection;
  confidence: InvestmentMarketConfidenceProjection;
  risks: readonly InvestmentMarketRiskProjection[];
  dataGaps: readonly InvestmentMarketDataGapProjection[];
  evidence: readonly InvestmentMarketEvidenceReference[];
  lineage: InvestmentMarketContextLineage;
  analyzedAt: Date;
}>;

export type InvestmentMarketEvidenceUsability = Readonly<{
  saleValuation: InvestmentMarketEvidenceUsabilityLevel;
  longTermRent: InvestmentMarketEvidenceUsabilityLevel;
  reasons: readonly string[];
}>;

export type BuildInvestmentMarketContextInput = MarketAnalysisReport;
