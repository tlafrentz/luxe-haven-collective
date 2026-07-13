import type {
  OpportunityCategory,
  OpportunitySeverity,
  RevenueOpportunity,
} from "./revenue-opportunity";

export type OpportunitySummary = {
  total: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  estimatedRevenueImpact: number;
  currency: string;
  byCategory: Record<OpportunityCategory, number>;
  bySeverity: Record<OpportunitySeverity, number>;
};

export type OpportunityReport = {
  opportunities: RevenueOpportunity[];
  summary: OpportunitySummary;
  generatedAt: string;
};

