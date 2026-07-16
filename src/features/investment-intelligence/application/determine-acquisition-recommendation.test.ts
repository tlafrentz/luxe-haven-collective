import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionRecommendation,
  ConfidenceLevel,
  EvidenceDirection,
  EvidenceType,
  RiskSeverity,
} from "../domain";

import type {
  InvestmentRisk,
  InvestmentScore,
  SupportingEvidence,
} from "../domain";

import {
  determineAcquisitionRecommendation,
} from "./determine-acquisition-recommendation";

function createInvestmentScore(
  overall: number,
  riskExposure: number,
): InvestmentScore {
  return {
    overall: {
      value: overall,
      max: 100,
    },
    revenuePotential: {
      value: overall,
      max: 100,
    },
    financialStrength: {
      value: overall,
      max: 100,
    },
    marketStrength: {
      value: overall,
      max: 100,
    },
    competitivePosition: {
      value: overall,
      max: 100,
    },
    riskExposure: {
      value: riskExposure,
      max: 100,
    },
  };
}

function createPositiveEvidence(
  id: string,
  confidence: ConfidenceLevel =
    ConfidenceLevel.High,
): SupportingEvidence {
  return {
    id,
    type: EvidenceType.FinancialModel,
    direction:
      EvidenceDirection.Positive,
    title: "Positive evidence",
    description:
      "The investment exceeds the applicable performance threshold.",
    source:
      "Investment analysis",
    confidence,
  };
}

function createRisk(
  severity: RiskSeverity,
): InvestmentRisk {
  return {
    id: `risk-${severity}`,
    title: `${severity} risk`,
    description:
      "The investment contains a material risk.",
    severity,
    probability: {
      value: 75,
    },
    mitigation:
      "Review the operating plan.",
  };
}

describe("determineAcquisitionRecommendation", () => {
  it("returns Strong Buy for an exceptional, low-risk, well-supported investment", () => {
    const result =
      determineAcquisitionRecommendation({
        score:
          createInvestmentScore(
            90,
            20,
          ),
        risks: [],
        supportingEvidence: [
          createPositiveEvidence(
            "evidence-1",
          ),
          createPositiveEvidence(
            "evidence-2",
          ),
          createPositiveEvidence(
            "evidence-3",
          ),
        ],
        revenueConfidence: {
          value: 90,
        },
        comparableConfidence:
          ConfidenceLevel.VeryHigh,
      });

    expect(result).toEqual({
      recommendation:
        AcquisitionRecommendation.StrongBuy,
      confidence:
        ConfidenceLevel.VeryHigh,
    });
  });

  it("returns Buy for a strong investment that does not meet the Strong Buy threshold", () => {
    const result =
      determineAcquisitionRecommendation({
        score:
          createInvestmentScore(
            78,
            30,
          ),
        risks: [],
        supportingEvidence: [
          createPositiveEvidence(
            "evidence-1",
          ),
          createPositiveEvidence(
            "evidence-2",
          ),
        ],
        revenueConfidence: {
          value: 85,
        },
        comparableConfidence:
          ConfidenceLevel.High,
      });

    expect(
      result.recommendation,
    ).toBe(
      AcquisitionRecommendation.Buy,
    );

    expect(result.confidence).toBe(
      ConfidenceLevel.High,
    );
  });

  it("returns Buy With Conditions when the score is viable but risks require mitigation", () => {
    const result =
      determineAcquisitionRecommendation({
        score:
          createInvestmentScore(
            65,
            55,
          ),
        risks: [
          createRisk(
            RiskSeverity.High,
          ),
        ],
        supportingEvidence: [
          createPositiveEvidence(
            "evidence-1",
          ),
        ],
        revenueConfidence: {
          value: 80,
        },
        comparableConfidence:
          ConfidenceLevel.High,
      });

    expect(
      result.recommendation,
    ).toBe(
      AcquisitionRecommendation
        .BuyWithConditions,
    );
  });

  it("returns Wait when decision confidence is low", () => {
    const result =
      determineAcquisitionRecommendation({
        score:
          createInvestmentScore(
            80,
            25,
          ),
        risks: [],
        supportingEvidence: [
          createPositiveEvidence(
            "evidence-1",
            ConfidenceLevel.Low,
          ),
          createPositiveEvidence(
            "evidence-2",
            ConfidenceLevel.Low,
          ),
        ],
        revenueConfidence: {
          value: 45,
        },
        comparableConfidence:
          ConfidenceLevel.Low,
      });

    expect(
      result.recommendation,
    ).toBe(
      AcquisitionRecommendation.Wait,
    );

    expect(result.confidence).toBe(
      ConfidenceLevel.Low,
    );
  });

  it("returns Pass when the investment contains a critical risk", () => {
    const result =
      determineAcquisitionRecommendation({
        score:
          createInvestmentScore(
            85,
            60,
          ),
        risks: [
          createRisk(
            RiskSeverity.Critical,
          ),
        ],
        supportingEvidence: [
          createPositiveEvidence(
            "evidence-1",
          ),
          createPositiveEvidence(
            "evidence-2",
          ),
          createPositiveEvidence(
            "evidence-3",
          ),
        ],
        revenueConfidence: {
          value: 90,
        },
        comparableConfidence:
          ConfidenceLevel.High,
      });

    expect(
      result.recommendation,
    ).toBe(
      AcquisitionRecommendation.Pass,
    );
  });

  it("returns Pass when the overall score is below the minimum viable threshold", () => {
    const result =
      determineAcquisitionRecommendation({
        score:
          createInvestmentScore(
            35,
            50,
          ),
        risks: [],
        supportingEvidence: [],
        revenueConfidence: {
          value: 85,
        },
        comparableConfidence:
          ConfidenceLevel.High,
      });

    expect(
      result.recommendation,
    ).toBe(
      AcquisitionRecommendation.Pass,
    );
  });

  it("does not return Buy when positive evidence is insufficient", () => {
    const result =
      determineAcquisitionRecommendation({
        score:
          createInvestmentScore(
            78,
            30,
          ),
        risks: [],
        supportingEvidence: [
          createPositiveEvidence(
            "evidence-1",
          ),
        ],
        revenueConfidence: {
          value: 85,
        },
        comparableConfidence:
          ConfidenceLevel.High,
      });

    expect(
      result.recommendation,
    ).toBe(
      AcquisitionRecommendation
        .BuyWithConditions,
    );
  });

  it("does not return Strong Buy when a high-severity risk exists", () => {
    const result =
      determineAcquisitionRecommendation({
        score:
          createInvestmentScore(
            92,
            20,
          ),
        risks: [
          createRisk(
            RiskSeverity.High,
          ),
        ],
        supportingEvidence: [
          createPositiveEvidence(
            "evidence-1",
          ),
          createPositiveEvidence(
            "evidence-2",
          ),
          createPositiveEvidence(
            "evidence-3",
          ),
        ],
        revenueConfidence: {
          value: 95,
        },
        comparableConfidence:
          ConfidenceLevel.VeryHigh,
      });

    expect(
      result.recommendation,
    ).toBe(
      AcquisitionRecommendation
        .BuyWithConditions,
    );
  });

  it("supports a custom recommendation policy", () => {
    const result =
      determineAcquisitionRecommendation({
        score:
          createInvestmentScore(
            72,
            35,
          ),
        risks: [],
        supportingEvidence: [
          createPositiveEvidence(
            "evidence-1",
          ),
        ],
        revenueConfidence: {
          value: 85,
        },
        comparableConfidence:
          ConfidenceLevel.High,
        policy: {
          strongBuyMinimumScore: 80,
          buyMinimumScore: 70,
          buyWithConditionsMinimumScore:
            50,
          waitMinimumScore: 30,
          strongBuyMaximumRiskExposure:
            30,
          buyMaximumRiskExposure: 40,
          buyWithConditionsMaximumRiskExposure:
            70,
          strongBuyMinimumPositiveEvidence:
            2,
          buyMinimumPositiveEvidence: 1,
        },
      });

    expect(
      result.recommendation,
    ).toBe(
      AcquisitionRecommendation.Buy,
    );
  });

  it.each([
    -1,
    101,
  ])(
    "rejects an overall score outside the 0 to 100 range: %s",
    (value) => {
      expect(() =>
        determineAcquisitionRecommendation({
          score:
            createInvestmentScore(
              value,
              30,
            ),
          risks: [],
          supportingEvidence: [],
          revenueConfidence: {
            value: 80,
          },
          comparableConfidence:
            ConfidenceLevel.High,
        }),
      ).toThrow(
        "Overall investment score must be between 0 and 100.",
      );
    },
  );

  it("is deterministic for identical inputs", () => {
    const input = {
      score:
        createInvestmentScore(
          78,
          30,
        ),
      risks: [],
      supportingEvidence: [
        createPositiveEvidence(
          "evidence-1",
        ),
        createPositiveEvidence(
          "evidence-2",
        ),
      ],
      revenueConfidence: {
        value: 85,
      },
      comparableConfidence:
        ConfidenceLevel.High,
    };

    expect(
      determineAcquisitionRecommendation(
        input,
      ),
    ).toEqual(
      determineAcquisitionRecommendation(
        input,
      ),
    );
  });
});
