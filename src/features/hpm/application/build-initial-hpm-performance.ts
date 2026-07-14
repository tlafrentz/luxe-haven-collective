import {
  HPM_PILLARS,
  type HpmHealthStatus,
  type HpmPerformanceReport,
  type HpmPillar,
  type HpmPillarScore,
  type HpmScoreChange,
} from "@/features/hpm/domain";

import type {
  RevenueIntelligence,
} from "@/features/revenue-intelligence";

type BuildInitialHpmPerformanceParams = {
  intelligence: RevenueIntelligence;
};

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function getHealthStatus(
  score: number | null,
): HpmHealthStatus {
  if (score === null) {
    return "unavailable";
  }

  if (score >= 90) {
    return "excellent";
  }

  if (score >= 75) {
    return "healthy";
  }

  if (score >= 60) {
    return "watch";
  }

  if (score >= 40) {
    return "needs-attention";
  }

  return "critical";
}

function getScoreChange(
  difference: number,
): HpmScoreChange {
  if (difference > 0) {
    return {
      difference,
      direction: "up",
    };
  }

  if (difference < 0) {
    return {
      difference,
      direction: "down",
    };
  }

  return {
    difference: 0,
    direction: "neutral",
  };
}

function calculateRevenueScore(
  intelligence: RevenueIntelligence,
): HpmPillarScore {
  const {
    current,
    comparison,
  } = intelligence.report;

  const occupancyScore = Math.min(
    100,
    current.occupancy.occupancyRate,
  );

  const revParTrendScore = clampScore(
    50 + comparison.revPar.percentChange,
  );

  const revenueTrendScore = clampScore(
    50 + comparison.grossRevenue.percentChange,
  );

  const cancellationScore = clampScore(
    100 - current.bookings.cancellationRate,
  );

  const score = clampScore(
    occupancyScore * 0.35 +
      revParTrendScore * 0.3 +
      revenueTrendScore * 0.25 +
      cancellationScore * 0.1,
  );

  return {
    pillar: "revenue",
    measurementStatus: "measured",
    score,
    healthStatus: getHealthStatus(score),
    confidence: 85,
    change: getScoreChange(
      comparison.revPar.percentChange,
    ),
    contributors: [
      {
        id: "revenue-occupancy",
        type:
          current.occupancy.occupancyRate >= 70
            ? "strength"
            : "opportunity",
        title: "Occupancy performance",
        description: `Occupancy is ${current.occupancy.occupancyRate.toFixed(
          1,
        )}% for the selected reporting period.`,
      },
      {
        id: "revenue-revpar-trend",
        type:
          comparison.revPar.direction === "up"
            ? "strength"
            : comparison.revPar.direction === "down"
              ? "risk"
              : "limitation",
        title: "RevPAR trend",
        description: `RevPAR changed ${comparison.revPar.percentChange.toFixed(
          1,
        )}% compared with the previous period.`,
      },
      {
        id: "revenue-gross-revenue-trend",
        type:
          comparison.grossRevenue.direction === "up"
            ? "strength"
            : comparison.grossRevenue.direction === "down"
              ? "risk"
              : "limitation",
        title: "Gross revenue trend",
        description: `Gross revenue changed ${comparison.grossRevenue.percentChange.toFixed(
          1,
        )}% compared with the previous period.`,
      },
    ],
  };
}

function calculateRiskScore(
  intelligence: RevenueIntelligence,
): HpmPillarScore {
  const riskOpportunities =
    intelligence.opportunityReport.opportunities.filter(
      (opportunity) =>
        opportunity.impact?.type === "revenue-at-risk" ||
        opportunity.impact?.type === "operational-risk" ||
        opportunity.severity === "high",
    );

  const highSeverityCount = riskOpportunities.filter(
    (opportunity) =>
      opportunity.severity === "high",
  ).length;

  const mediumSeverityCount = riskOpportunities.filter(
    (opportunity) =>
      opportunity.severity === "medium",
  ).length;

  const score = clampScore(
    100 -
      highSeverityCount * 18 -
      mediumSeverityCount * 8 -
      Math.max(
        0,
        riskOpportunities.length -
          highSeverityCount -
          mediumSeverityCount,
      ) *
        3,
  );

  return {
    pillar: "risk",
    measurementStatus: "partial",
    score,
    healthStatus: getHealthStatus(score),
    confidence: 55,
    change: null,
    contributors:
      riskOpportunities.length > 0
        ? riskOpportunities.slice(0, 5).map(
            (opportunity) => ({
              id: opportunity.id,
              type: "risk" as const,
              title: opportunity.title,
              description: opportunity.summary,
              impact:
                opportunity.impact?.estimatedAmount,
            }),
          )
        : [
            {
              id: "risk-no-active-signals",
              type: "strength",
              title: "No active revenue-risk signals",
              description:
                "The current Revenue Intelligence analysis did not identify an active revenue or operational risk.",
            },
          ],
  };
}

function createUnavailablePillar(
  pillar: HpmPillar,
  reason: string,
): HpmPillarScore {
  return {
    pillar,
    measurementStatus: "unavailable",
    score: null,
    healthStatus: "unavailable",
    confidence: null,
    change: null,
    contributors: [
      {
        id: `${pillar}-data-unavailable`,
        type: "limitation",
        title: "Additional data required",
        description: reason,
      },
    ],
    unavailableReason: reason,
  };
}

export function buildInitialHpmPerformance({
  intelligence,
}: BuildInitialHpmPerformanceParams): HpmPerformanceReport {
  const revenue =
    calculateRevenueScore(intelligence);

  const risk =
    calculateRiskScore(intelligence);

  const pillars: Record<
    HpmPillar,
    HpmPillarScore
  > = {
    investment: createUnavailablePillar(
      "investment",
      "Investment basis, financing, market benchmarks, and return targets have not been connected.",
    ),
    financial: createUnavailablePillar(
      "financial",
      "Operating expenses, debt service, cash flow, and profitability data have not been connected.",
    ),
    revenue,
    operations: createUnavailablePillar(
      "operations",
      "Cleaning, maintenance, task, vendor, and service-delivery data have not been connected.",
    ),
    "guest-experience":
      createUnavailablePillar(
        "guest-experience",
        "Review, rating, complaint, response-quality, and repeat-guest data have not been connected.",
      ),
    risk,
    growth: createUnavailablePillar(
      "growth",
      "Portfolio expansion, direct-booking, marketing, automation-adoption, and brand-growth data have not been connected.",
    ),
  };

  const measuredPillars =
    HPM_PILLARS.filter(
      (pillar) =>
        pillars[pillar].measurementStatus ===
        "measured",
    );

  const partialPillars =
    HPM_PILLARS.filter(
      (pillar) =>
        pillars[pillar].measurementStatus ===
        "partial",
    );

  const unavailablePillars =
    HPM_PILLARS.filter(
      (pillar) =>
        pillars[pillar].measurementStatus ===
        "unavailable",
    );

  const measuredPillarCount =
    measuredPillars.length;

  const coveragePercentage = Math.round(
    ((measuredPillarCount +
      partialPillars.length * 0.5) /
      HPM_PILLARS.length) *
      100,
  );

  const scope =
    intelligence.report.current.scope.type ===
    "property"
      ? {
          type: "property" as const,
          propertyId:
            intelligence.report.current.scope
              .propertyId,
          propertyCount: 1 as const,
        }
      : {
          type: "portfolio" as const,
          propertyId: null,
          propertyCount:
            intelligence.report.current.scope
              .propertyCount,
        };

  return {
    scope,
    overall: {
      score: null,
      healthStatus: "unavailable",
      measurementStatus: "partial",
      confidence: null,
      change: null,
    },
    pillars,
    dataCoverage: {
      measuredPillars,
      partialPillars,
      unavailablePillars,
      measuredPillarCount,
      totalPillarCount: HPM_PILLARS.length,
      coveragePercentage,
    },
    generatedAt: intelligence.generatedAt,
  };
}
