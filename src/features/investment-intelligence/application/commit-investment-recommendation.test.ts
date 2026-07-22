import {
  describe,
  expect,
  it,
} from "vitest";

import {
  DecisionMode,
} from "@/platform/decisions";

import {
  AcquisitionType,
} from "../domain";
import {
  mapInvestmentPlatformAnalysis,
} from "./adapters/map-investment-platform-analysis";
import {
  createPurchaseLifecycleResult,
  createRentalLifecycleResult,
} from "./__tests__/fixtures/investment-lifecycle.fixture";

import {
  commitInvestmentRecommendation,
  InvestmentCommitmentError,
} from "./commit-investment-recommendation";

import type {
  InvestmentLifecycleResult,
  InvestmentPlatformAnalysis,
} from "../domain";
import type {
  InvestmentCommitmentResponse,
} from "./types/investment-commitment-types";

const decidedAt =
  new Date("2026-02-01T12:00:00Z");

function platformAnalysis(
  lifecycleResult: InvestmentLifecycleResult,
  runId = "investment-run-007a",
): InvestmentPlatformAnalysis {
  return mapInvestmentPlatformAnalysis(
    lifecycleResult,
    {
      runId,
      observedAt:
        new Date("2026-01-31T12:00:00Z"),
    },
  );
}

function command(
  lifecycleResult: InvestmentLifecycleResult,
  platform = platformAnalysis(
    lifecycleResult,
  ),
  response:
    InvestmentCommitmentResponse =
      "accept",
) {
  return {
    lifecycleResult,
    platformAnalysis: platform,
    recommendationId:
      platform.recommendations
        .toArray()[0].id.value,
    response,
    rationale:
      "The operator reviewed the underwriting evidence.",
    actor: {
      id: "operator-42",
      displayName: "Investment Operator",
    },
    context: {
      decisionId:
        "decision-investment-007a",
      decidedAt,
    },
  } as const;
}

describe("commitInvestmentRecommendation", () => {
  it("accepts a purchase recommendation with deterministic operator and lineage data", () => {
    const lifecycle =
      createPurchaseLifecycleResult();
    const platform =
      platformAnalysis(lifecycle);
    const result =
      commitInvestmentRecommendation(
        command(lifecycle, platform),
      );
    const recommendation =
      platform.recommendations
        .toArray()[0];

    expect(result.acquisitionType).toBe(
      AcquisitionType.Purchase,
    );
    expect(result.response).toBe(
      "accept",
    );
    expect(result.decision.id.value).toBe(
      "decision-investment-007a",
    );
    expect(result.decision.decidedAt).toEqual(
      decidedAt,
    );
    expect(result.decision.outcome).toBe(
      "accepted",
    );
    expect(result.decision.mode).toBe(
      DecisionMode.HUMAN_APPROVED,
    );
    expect(
      result.decision.recommendationIds
        .map(({ value }) => value),
    ).toEqual([recommendation.id.value]);
    expect(
      result.decision.evaluationIds
        .map(({ value }) => value),
    ).toEqual(
      recommendation.evaluationIds
        .map(({ value }) => value),
    );
    expect(result.decision.metadata).toMatchObject({
      actorId: "operator-42",
      actorDisplayName:
        "Investment Operator",
      platformRunId:
        "investment-run-007a",
      acquisitionType:
        AcquisitionType.Purchase,
      rationaleSource: "operator",
    });
    expect(result.decision.rationale.summary)
      .toBe(
        "The operator reviewed the underwriting evidence.",
      );
    expect("actions" in result).toBe(false);
  });

  it.each([
    ["reject", "rejected", DecisionMode.REJECTED],
    ["defer", "deferred", DecisionMode.DEFERRED],
  ] as const)(
    "records a distinct %s Decision without changing the recommendation",
    (response, outcome, mode) => {
      const lifecycle =
        createPurchaseLifecycleResult();
      const platform =
        platformAnalysis(lifecycle);
      const recommendation =
        platform.recommendations
          .toArray()[0];
      const result =
        commitInvestmentRecommendation(
          command(
            lifecycle,
            platform,
            response,
          ),
        );

      expect(result.decision.outcome).toBe(
        outcome,
      );
      expect(result.decision.mode).toBe(mode);
      expect(result.recommendation).toBe(
        recommendation,
      );
      expect("actions" in result).toBe(false);
    },
  );

  it("commits a rental-arbitrage recommendation without purchase-only inputs", () => {
    const lifecycle =
      createRentalLifecycleResult();
    const result =
      commitInvestmentRecommendation(
        command(lifecycle),
      );

    expect(result.acquisitionType).toBe(
      AcquisitionType.RentalArbitrage,
    );
    expect(result.decision.context.scope)
      .toBe(
        AcquisitionType.RentalArbitrage,
      );
    expect(result.decision.outcome).toBe(
      "accepted",
    );
  });

  it("requires an explicitly selected recommendation", () => {
    const lifecycle =
      createPurchaseLifecycleResult();
    const input = command(lifecycle);

    expect(() =>
      commitInvestmentRecommendation({
        ...input,
        recommendationId:
          "recommendation-unknown",
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_COMMITMENT_RECOMMENDATION_NOT_FOUND",
      }),
    );
  });

  it.each([
    [
      createPurchaseLifecycleResult(),
      platformAnalysis(
        createRentalLifecycleResult(),
      ),
    ],
    [
      createRentalLifecycleResult(),
      platformAnalysis(
        createPurchaseLifecycleResult(),
      ),
    ],
  ])("rejects lifecycle and Platform route mismatches", (lifecycle, mismatchedPlatform) => {
    expect(() =>
      commitInvestmentRecommendation({
        ...command(
          lifecycle,
          mismatchedPlatform,
        ),
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_COMMITMENT_ROUTE_MISMATCH",
      }),
    );
  });

  it("rejects mismatched Investment subjects", () => {
    const lifecycle =
      createPurchaseLifecycleResult();
    const platform =
      platformAnalysis(lifecycle);
    const mismatched = {
      ...lifecycle,
      analysis: {
        ...lifecycle.analysis,
        property: {
          ...lifecycle.analysis.property,
          id: "different-property",
        },
      },
    } satisfies InvestmentLifecycleResult;

    expect(() =>
      commitInvestmentRecommendation(
        command(mismatched, platform),
      ),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_COMMITMENT_SUBJECT_MISMATCH",
      }),
    );
  });

  it("rejects recommendation and Platform run mismatches", () => {
    const lifecycle =
      createPurchaseLifecycleResult();
    const platform =
      platformAnalysis(lifecycle);
    const mismatched = {
      ...platform,
      lineage: {
        ...platform.lineage,
        runId: "unrelated-run",
      },
    } satisfies InvestmentPlatformAnalysis;

    expect(() =>
      commitInvestmentRecommendation(
        command(lifecycle, mismatched),
      ),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_COMMITMENT_RUN_MISMATCH",
      }),
    );
  });

  it("is deterministic for the same command and context", () => {
    const lifecycle =
      createRentalLifecycleResult();
    const input = command(lifecycle);

    expect(
      commitInvestmentRecommendation(input),
    ).toEqual(
      commitInvestmentRecommendation(input),
    );
  });

  it("uses stable validation errors", () => {
    const lifecycle =
      createPurchaseLifecycleResult();
    const input = command(lifecycle);

    expect(() =>
      commitInvestmentRecommendation({
        ...input,
        rationale: "   ",
      }),
    ).toThrowError(
      InvestmentCommitmentError,
    );
  });
});
