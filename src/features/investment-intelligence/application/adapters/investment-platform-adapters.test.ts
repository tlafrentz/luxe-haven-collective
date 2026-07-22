import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionType,
} from "../../domain";

import {
  createPurchaseLifecycleResult,
  createRentalLifecycleResult,
} from "../__tests__/fixtures/investment-lifecycle.fixture";

import {
  INVESTMENT_OBSERVATION_TYPES,
} from "../types/investment-observation-types";

import {
  buildInvestmentWorkspaceView,
} from "./investment-workspace-adapter";
import {
  mapInvestmentPlatformAnalysis,
} from "./map-investment-platform-analysis";

const context = {
  runId: "investment-platform-test-run",
  observedAt:
    new Date("2026-01-01T00:00:00Z"),
  sourceQuality: {
    comparables: "verified",
    utilitiesResponsibility:
      "verified",
    regulation: "verified",
  },
} as const;

describe("Investment Platform adapters", () => {
  it("preserves purchase semantics through the lifecycle boundary", () => {
    const result =
      createPurchaseLifecycleResult();
    const view =
      buildInvestmentWorkspaceView(
        result,
        context,
      );

    expect(view.projection).toBe(
      result.analysis,
    );
    expect(view.platform.acquisitionType)
      .toBe(AcquisitionType.Purchase);
    expect(view.platform.observations.size)
      .toBeGreaterThan(0);
    expect(view.platform.evidence.size)
      .toBe(
        result.analysis.supportingEvidence
          .length,
      );
    expect(view.platform.claims.size)
      .toBeGreaterThan(0);
    expect(view.platform.evaluations.size)
      .toBe(view.platform.claims.size);
    expect(view.platform.recommendations.size)
      .toBe(1);
    expect(view.platform.scores.overall.value)
      .toBe(
        result.analysis.score.overall.value,
      );
    expect(
      view.platform.observations.ofType(
        INVESTMENT_OBSERVATION_TYPES.strategy
          .targetOfferPrice,
      ).size,
    ).toBe(1);
  });

  it("maps complete rental reasoning and derived stress evidence", () => {
    const result =
      createRentalLifecycleResult();
    const view =
      buildInvestmentWorkspaceView(
        result,
        context,
      );

    expect(view.projection).toBe(
      result.analysis,
    );
    expect(view.platform.acquisitionType)
      .toBe(
        AcquisitionType.RentalArbitrage,
      );
    expect(view.platform.evidence.size)
      .toBe(
        result.analysis.supportingEvidence
          .length + 1,
      );
    expect(view.platform.claims.size)
      .toBe(
        result.analysis.risks.length + 1,
      );
    expect(view.platform.evaluations.size)
      .toBe(view.platform.claims.size);
    expect(view.platform.recommendations.size)
      .toBe(1);
    expect(view.platform.scores.overall.value)
      .toBe(
        result.analysis.score.overall.value,
      );
    expect(
      view.platform.observations.ofType(
        INVESTMENT_OBSERVATION_TYPES
          .financial
          .leaseCoverageRatio,
      ).size,
    ).toBe(1);
  });

  it("is deterministic for a fixed result and run context", () => {
    const result =
      createRentalLifecycleResult();

    expect(
      mapInvestmentPlatformAnalysis(
        result,
        context,
      ),
    ).toEqual(
      mapInvestmentPlatformAnalysis(
        result,
        context,
      ),
    );
  });

  it("preserves supplied upstream IDs and does not invent absent lineage", () => {
    const result =
      createPurchaseLifecycleResult();
    const upstream =
      mapInvestmentPlatformAnalysis(
        createRentalLifecycleResult(),
        {
          ...context,
          runId: "upstream-run",
        },
      );
    const withoutUpstream =
      mapInvestmentPlatformAnalysis(
        result,
        context,
      );
    const withUpstream =
      mapInvestmentPlatformAnalysis(
        result,
        {
          ...context,
          upstream: {
            market: {
              observations:
                upstream.observations,
              evidence: upstream.evidence,
              claims: upstream.claims,
              evaluations:
                upstream.evaluations,
              recommendations:
                upstream.recommendations,
            },
          },
        },
      );

    expect(
      withoutUpstream.lineage
        .marketObservationIds,
    ).toEqual([]);
    expect(
      withUpstream.lineage
        .marketObservationIds,
    ).toEqual(
      upstream.observations
        .toArray()
        .map(({ id }) => id.value),
    );
    expect(
      withUpstream.lineage.evidenceIds,
    ).toEqual(
      upstream.evidence
        .toArray()
        .map(({ id }) => id.value),
    );
  });

});
