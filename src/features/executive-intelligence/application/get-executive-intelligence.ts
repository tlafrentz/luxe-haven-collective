import type {
  AnalyticsQueryParams,
} from "@/features/analytics";

import {
  buildInitialHpmPerformance,
} from "@/features/hpm";

import {
  getRevenueIntelligence,
} from "@/features/revenue-intelligence";

import type {
  ExecutiveIntelligenceReport,
} from "../domain";

import {
  buildExecutiveBrief,
} from "./build-executive-brief";

import {
  buildExecutivePriorities,
} from "./build-executive-priorities";

import {
  buildPortfolioChanges,
} from "./build-portfolio-changes";

import {
  buildPortfolioHealth,
} from "./build-portfolio-health";

import {
  buildPortfolioSnapshot,
} from "./build-portfolio-snapshot";

import {
  buildRevenueRiskSummary,
} from "./build-revenue-risk-summary";

export async function getExecutiveIntelligence({
  propertyId,
  startDate,
  endDate,
  generatedAt = new Date().toISOString(),
}: AnalyticsQueryParams & {
  generatedAt?: string;
}): Promise<ExecutiveIntelligenceReport> {
  const revenueIntelligence =
    await getRevenueIntelligence({
      propertyId,
      startDate,
      endDate,
      detectedAt: generatedAt,
    });

  const hpmPerformance =
    buildInitialHpmPerformance({
      intelligence:
        revenueIntelligence,
    });

  const portfolioSnapshot =
    buildPortfolioSnapshot(
      revenueIntelligence,
    );

  const revenueRisk =
    buildRevenueRiskSummary(
      revenueIntelligence,
    );

  const priorities =
    buildExecutivePriorities(
      revenueIntelligence,
    );

  const changes =
    buildPortfolioChanges(
      revenueIntelligence,
    );

  const portfolioHealth =
    buildPortfolioHealth(
      hpmPerformance,
    );

  const executiveBrief =
    buildExecutiveBrief({
      hpmPerformance,
      portfolioSnapshot,
      revenueRisk,
      priorities,
    });

  return {
    generatedAt,
    dateRange:
      revenueIntelligence.report.dateRange,
    selectedProperty:
      revenueIntelligence.report
        .selectedProperty,
    properties:
      revenueIntelligence.report.properties,
    portfolioHealth,
    executiveBrief,
    hpmPerformance,
    portfolioSnapshot,
    revenueRisk,
    priorities,
    changes,
  };
}
