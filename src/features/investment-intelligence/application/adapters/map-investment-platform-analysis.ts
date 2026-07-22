import {
  Claim,
  ClaimCollection,
  createClaimId,
} from "@/platform/claims";
import {
  Evaluation,
  EvaluationCollection,
  EvaluationDisposition,
  createEvaluationId,
} from "@/platform/evaluations";
import {
  Evidence,
  EvidenceCollection,
  EvidenceDirection,
  EvidenceStrength,
  createEvidenceId,
} from "@/platform/evidence";
import {
  Recommendation,
  RecommendationCollection,
  RecommendationPriority,
  createRecommendationId,
} from "@/platform/recommendations";
import {
  ConfidenceAssessment,
  ConfidenceLevel,
  ConfidenceScore,
  Score,
  ScoreScale,
} from "@/platform/scoring";

import {
  AcquisitionRecommendation,
  AcquisitionType,
  ConfidenceLevel as InvestmentConfidenceLevel,
  EvidenceDirection as InvestmentEvidenceDirection,
  EvidenceType as InvestmentEvidenceType,
} from "../../domain";

import type {
  InvestmentLifecycleResult,
  InvestmentPlatformAnalysis,
  SupportingEvidence,
} from "../../domain";

import {
  investmentObservationProvider,
} from "../providers";

import {
  buildInvestmentDataGaps,
} from "./build-investment-data-gaps";

import {
  createInvestmentPlatformRunContext,
  normalizeInvestmentPlatformRunContext,
} from "./investment-platform-run-context";

import type {
  InvestmentPlatformRunContext,
} from "./investment-platform-run-context";

import {
  normalizeInvestmentUpstream,
} from "./investment-upstream-adapter";

export function mapInvestmentPlatformAnalysis(
  result: InvestmentLifecycleResult,
  runContext:
    InvestmentPlatformRunContext =
    createInvestmentPlatformRunContext(),
): InvestmentPlatformAnalysis {
  const context =
    normalizeInvestmentPlatformRunContext(
      runContext,
    );

  switch (result.acquisitionType) {
    case AcquisitionType.Purchase:
      return mapRoutePlatformAnalysis(
        result,
        context,
      );

    case AcquisitionType.RentalArbitrage:
      return mapRoutePlatformAnalysis(
        result,
        context,
      );

    default:
      return assertNever(result);
  }
}

function mapRoutePlatformAnalysis(
  result: InvestmentLifecycleResult,
  context: InvestmentPlatformRunContext & {
    readonly recordedAt: Date;
  },
): InvestmentPlatformAnalysis {
  const projection = result.analysis;
  const observations =
    investmentObservationProvider.build(
      result,
      context,
    );
  const observationValues =
    observations.toArray();
  const subject = {
    type: "property",
    id: projection.property.id,
  };
  const createdAt =
    new Date(context.recordedAt);
  const upstream =
    normalizeInvestmentUpstream(
      context.upstream ?? {},
    );
  const sourceEvidence = [
    ...projection.supportingEvidence,
    ...rentalStressEvidence(result),
  ];

  const evidenceValues =
    sourceEvidence.map((item, index) =>
      Evidence.create({
        id: createEvidenceId(
          `${context.runId}-evidence-${slug(item.id || String(index + 1))}`,
        ),
        type: `investment.${item.type}`,
        subject,
        title: item.title,
        explanation: item.description,
        direction:
          item.direction ===
          InvestmentEvidenceDirection.Positive
            ? EvidenceDirection.SUPPORTING
            : EvidenceDirection.OPPOSING,
        strength:
          evidenceStrength(item.confidence),
        source: {
          capability:
            "investment-intelligence",
          name: item.source,
        },
        observationIds: [
          observationValues[
            index %
              observationValues.length
          ].id,
        ],
        createdAt,
        metadata: {
          compatibilityEvidenceId:
            item.id,
          runId: context.runId,
          acquisitionType:
            result.acquisitionType,
          ...(upstream.evidenceIds.length > 0
            ? {
                upstreamEvidenceIds:
                  upstream.evidenceIds,
              }
            : {}),
        },
      }),
    );

  const claimInputs = [
    {
      type:
        "investment.acquisition-viability",
      statement:
        recommendationStatement(
          projection.recommendation,
        ),
      summary:
        `The acquisition underwriting result is ${projection.recommendation}.`,
      score: projection.score.overall.value,
    },
    ...projection.risks.map((risk) => ({
      type: "investment.risk",
      statement: risk.description,
      summary:
        `${risk.title}: ${risk.description}`,
      score: Math.max(
        0,
        100 - risk.probability.value,
      ),
    })),
  ];

  const claims = claimInputs.map(
    (item, index) =>
      Claim.create({
        id: createClaimId(
          `${context.runId}-claim-${index + 1}`,
        ),
        type: item.type,
        subject,
        statement: item.statement,
        source: {
          capability:
            "investment-intelligence",
          name: "underwriting-policy",
        },
        evidenceIds: evidenceValues.map(
          (value) => value.id,
        ),
        createdAt,
        metadata: {
          underwritingScore: item.score,
          runId: context.runId,
          upstreamRecommendationIds:
            upstream.recommendationIds,
        },
      }),
  );

  const confidence =
    confidenceAssessment(
      projection.confidence,
    );
  const evaluations = claims.map(
    (claim, index) =>
      Evaluation.create({
        id: createEvaluationId(
          `${context.runId}-evaluation-${index + 1}`,
        ),
        type:
          index === 0
            ? "investment.acquisition-assessment"
            : "investment.risk-assessment",
        claimId: claim.id,
        disposition:
          index === 0
            ? recommendationDisposition(
                projection.recommendation,
              )
            : EvaluationDisposition.MIXED,
        summary: claimInputs[index].summary,
        confidence,
        evidenceIds: evidenceValues.map(
          (value) => value.id,
        ),
        source: {
          capability:
            "investment-intelligence",
          name: "underwriting-policy",
        },
        evaluatedAt: createdAt,
      }),
  );

  const recommendation =
    Recommendation.create({
      id: createRecommendationId(
        `${context.runId}-acquisition-recommendation`,
      ),
      summary:
        recommendationStatement(
          projection.recommendation,
        ),
      rationale: [
        `Overall underwriting score: ${projection.score.overall.value}/100.`,
        ...projection.supportingEvidence
          .slice(0, 4)
          .map(
            (value) => value.description,
          ),
      ],
      priority:
        recommendationPriority(
          projection.recommendation,
        ),
      category: "investment-acquisition",
      confidence,
      evaluationIds: evaluations.map(
        (value) => value.id,
      ),
      evidenceIds: evidenceValues.map(
        (value) => value.id,
      ),
      claimIds: claims.map(
        (value) => value.id,
      ),
      observationIds:
        observationValues.map(
          (value) => value.id,
        ),
      metadata: {
        acquisitionRecommendation:
          projection.recommendation,
        acquisitionType:
          projection.acquisitionType,
        propertyId: projection.property.id,
        runId: context.runId,
        upstreamIntelligenceReportIds:
          upstream.intelligenceReportIds,
      },
    });

  return {
    acquisitionType:
      result.acquisitionType,
    observations,
    evidence:
      EvidenceCollection.create(
        evidenceValues,
      ),
    claims:
      ClaimCollection.create(claims),
    evaluations:
      EvaluationCollection.create(
        evaluations,
      ),
    recommendations:
      RecommendationCollection.create([
        recommendation,
      ]),
    scores: {
      overall:
        platformScore(
          projection.score.overall.value,
        ),
      revenuePotential:
        platformScore(
          projection.score
            .revenuePotential.value,
        ),
      financialStrength:
        platformScore(
          projection.score
            .financialStrength.value,
        ),
      marketStrength:
        platformScore(
          projection.score
            .marketStrength.value,
        ),
      competitivePosition:
        platformScore(
          projection.score
            .competitivePosition.value,
        ),
      riskExposure:
        platformScore(
          projection.score
            .riskExposure.value,
        ),
    },
    dataGaps:
      buildInvestmentDataGaps(
        result,
        context,
      ),
    lineage: {
      runId: context.runId,
      ...upstream,
    },
  };
}

function rentalStressEvidence(
  result: InvestmentLifecycleResult,
): readonly SupportingEvidence[] {
  if (
    result.acquisitionType !==
    AcquisitionType.RentalArbitrage
  ) {
    return [];
  }

  const summary =
    result.derivedAnalysis.stressTests;

  return [
    {
      id: "rental-market-stress-summary",
      type:
        InvestmentEvidenceType.FinancialModel,
      direction:
        summary.overallOutcome ===
        "resilient"
          ? InvestmentEvidenceDirection.Positive
          : InvestmentEvidenceDirection.Caution,
      title:
        "Rental market stress-test summary",
      description: summary.summary,
      source:
        "Rental arbitrage stress analysis",
      confidence:
        result.analysis.confidence,
    },
  ];
}

function platformScore(value: number): Score {
  return Score.create(
    value,
    ScoreScale.ZERO_TO_ONE_HUNDRED,
  );
}

function confidenceAssessment(
  value: InvestmentConfidenceLevel,
): ConfidenceAssessment {
  const scores: Record<
    InvestmentConfidenceLevel,
    number
  > = {
    [InvestmentConfidenceLevel.VeryHigh]: 95,
    [InvestmentConfidenceLevel.High]: 80,
    [InvestmentConfidenceLevel.Moderate]: 60,
    [InvestmentConfidenceLevel.Low]: 35,
    [InvestmentConfidenceLevel.VeryLow]: 15,
  };
  const score = scores[value];

  return ConfidenceAssessment.create({
    score: ConfidenceScore.create(score),
    level:
      score >= 80
        ? ConfidenceLevel.HIGH
        : score >= 50
          ? ConfidenceLevel.MODERATE
          : ConfidenceLevel.LOW,
    rationale: [
      `Mapped from Investment underwriting confidence: ${value}.`,
    ],
  });
}

function evidenceStrength(
  value: InvestmentConfidenceLevel,
): EvidenceStrength {
  if (
    value ===
      InvestmentConfidenceLevel.VeryHigh ||
    value === InvestmentConfidenceLevel.High
  ) {
    return EvidenceStrength.STRONG;
  }

  if (
    value ===
    InvestmentConfidenceLevel.Moderate
  ) {
    return EvidenceStrength.MODERATE;
  }

  return EvidenceStrength.WEAK;
}

function recommendationDisposition(
  value: AcquisitionRecommendation,
): EvaluationDisposition {
  if (
    value === AcquisitionRecommendation.Pass
  ) {
    return EvaluationDisposition.OPPOSED;
  }

  if (
    value === AcquisitionRecommendation.Wait ||
    value ===
      AcquisitionRecommendation
        .BuyWithConditions
  ) {
    return EvaluationDisposition.MIXED;
  }

  return EvaluationDisposition.SUPPORTED;
}

function recommendationPriority(
  value: AcquisitionRecommendation,
): RecommendationPriority {
  if (
    value ===
    AcquisitionRecommendation.StrongBuy
  ) {
    return RecommendationPriority.HIGH;
  }

  if (
    value === AcquisitionRecommendation.Buy ||
    value ===
      AcquisitionRecommendation
        .BuyWithConditions
  ) {
    return RecommendationPriority.MEDIUM;
  }

  return RecommendationPriority.LOW;
}

function recommendationStatement(
  value: AcquisitionRecommendation,
): string {
  return `Investment policy recommends ${value.replaceAll("-", " ")}.`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function assertNever(value: never): never {
  throw new TypeError(
    `Unsupported Investment lifecycle result: ${String(value)}`,
  );
}
