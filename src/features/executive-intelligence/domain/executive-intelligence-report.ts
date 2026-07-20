import type {
  AnalyticsDateRange,
  AnalyticsProperty,
} from "@/features/analytics";

import type {
  HpmPerformanceReport,
} from "@/features/hpm";

import type {
  ExecutiveBrief,
} from "./executive-brief";

import type {
  ExecutivePriority,
} from "./executive-priority";

import type {
  PortfolioChange,
} from "./portfolio-change";

import type {
  PortfolioHealth,
} from "./portfolio-health";

import type {
  PortfolioSnapshot,
} from "./portfolio-snapshot";

import type {
  RevenueRiskSummary,
} from "./revenue-risk";

/** @deprecated PM-005 dashboard compatibility projection. Use ExecutiveProjection for canonical orchestration. */
export type ExecutiveIntelligenceReport = {
  generatedAt: string;
  dateRange: AnalyticsDateRange;
  selectedProperty: AnalyticsProperty | null;
  properties: AnalyticsProperty[];
  portfolioHealth: PortfolioHealth;
  executiveBrief: ExecutiveBrief;
  hpmPerformance: HpmPerformanceReport;
  portfolioSnapshot: PortfolioSnapshot;
  revenueRisk: RevenueRiskSummary;
  priorities: ExecutivePriority[];
  changes: PortfolioChange[];
};
