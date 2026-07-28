import { describe, expect, it } from "vitest";
import {
  REANALYSIS_ASSUMPTION_CONTRACT,
  buildOpportunityAnalysisSnapshot,
  createInvestmentOpportunityWithResult,
  hydrateReanalysis,
  readImmutableAnalysis,
} from "../application";
import { InMemoryInvestmentOpportunityRepository } from "../infrastructure";
import {
  buildSavedPurchaseAnalysis,
  buildSavedRentalAnalysis,
  buildSubjectPropertyFixture,
  savedAnalysisFixtureClock,
  savedAnalysisFixtureIds,
} from "../test-support/saved-analysis-fixtures";
import {
  createPurchaseLifecycleResult,
  createRentalLifecycleResult,
} from "@/features/investment-intelligence/application/__tests__/fixtures/investment-lifecycle.fixture";

const actor = { type: "user" as const, id: savedAnalysisFixtureIds.owner };
const sourceSummary = {
  userSuppliedCount: 10,
  learningSuppliedCount: 0,
  marketSuppliedCount: 2,
  defaultSuppliedCount: 2,
  overrides: [],
  marketEvidenceAvailable: true,
} as const;

describe("SA-001G canonical Saved Analysis regression pack", () => {
  it("SA-001G.02 builds deterministic purchase and rental golden analyses", () => {
    const firstPurchase = buildSavedPurchaseAnalysis();
    const secondPurchase = buildSavedPurchaseAnalysis();
    const rental = buildSavedRentalAnalysis();

    expect(firstPurchase).toEqual(secondPurchase);
    expect(firstPurchase.route).toBe("purchase");
    expect(rental.route).toBe("rental-arbitrage");
    expect(firstPurchase.assumptions).toContainEqual(
      expect.objectContaining({
        key: "annual-insurance-premium",
        value: 2400,
        currency: "USD",
        period: "annual",
      }),
    );
    expect(rental.assumptions!.map(({ key }) => key)).not.toContain("purchase-price");
    expect(rental.assumptions!.map(({ key }) => key)).toContain("monthly-lease");
  });

  it("SA-001G.07 reuses one receipt and rejects a command reused with another payload", async () => {
    const repository = new InMemoryInvestmentOpportunityRepository();
    const baseLifecycleResult = createPurchaseLifecycleResult();
    const base = {
      authenticatedOwnerId: savedAnalysisFixtureIds.workspace,
      actor,
      route: "purchase" as const,
      property: propertyFor(baseLifecycleResult),
      commandId: "saved-analysis-command-1",
      occurredAt: savedAnalysisFixtureClock,
      initialAnalysis: {
        lifecycleResult: baseLifecycleResult,
        lifecycleResultId: "lifecycle-fixture-1",
        sourceSummary,
        snapshot: buildSavedPurchaseAnalysis(),
        analyzedAt: savedAnalysisFixtureClock,
      },
    };

    const first = await createInvestmentOpportunityWithResult(repository, {
      ...base,
      saveOptions: {
        payloadHash: "payload-a",
        initialNote: { note: { body: "Initial note", author: actor }, activity: { type: "note-added" } },
      },
    });
    const replay = await createInvestmentOpportunityWithResult(repository, {
      ...base,
      saveOptions: {
        payloadHash: "payload-a",
        initialNote: { note: { body: "Initial note", author: actor }, activity: { type: "note-added" } },
      },
    });

    expect(repository.snapshot()).toHaveLength(1);
    expect(replay.saveResult).toEqual({ ...first.saveResult, idempotent: true });
    await expect(
      createInvestmentOpportunityWithResult(repository, {
        ...base,
        saveOptions: { payloadHash: "payload-b" },
      }),
    ).rejects.toMatchObject({ code: "OPPORTUNITY_PERSISTENCE_FAILED" });
    expect(repository.snapshot()).toHaveLength(1);
  });

  it.each([
    ["purchase", createPurchaseLifecycleResult(), buildSavedPurchaseAnalysis()],
    ["rental-arbitrage", createRentalLifecycleResult(), buildSavedRentalAnalysis()],
  ] as const)(
    "SA-001G.12 preserves every %s assumption through persistence, immutable read, and hydration",
    async (route, lifecycleResult, snapshot) => {
      const repository = new InMemoryInvestmentOpportunityRepository();
      const { opportunity } = await createInvestmentOpportunityWithResult(repository, {
        authenticatedOwnerId: savedAnalysisFixtureIds.workspace,
        actor,
        route,
        property: propertyFor(lifecycleResult),
        commandId: `round-trip-${route}`,
        occurredAt: savedAnalysisFixtureClock,
        initialAnalysis: {
          lifecycleResult,
          lifecycleResultId: `lifecycle-${route}`,
          sourceSummary,
          snapshot,
          analyzedAt: savedAnalysisFixtureClock,
        },
        saveOptions: { payloadHash: `payload-${route}` },
      });
      const version = opportunity.props.analyses[0];
      const projection = await readImmutableAnalysis(repository, {
        ownerId: savedAnalysisFixtureIds.workspace,
        opportunityId: opportunity.id.value,
        analysisVersionId: version.id.value,
      });

      expect(projection).not.toBeNull();
      const hydrated = hydrateReanalysis(projection!, {
        workspaceId: savedAnalysisFixtureIds.workspace,
      });
      for (const assumption of snapshot.assumptions!) {
        expect(hydrated.assumptions[assumption.key]).toMatchObject({
          value: assumption.value,
          unit: assumption.unit,
          mode: assumption.mode,
          explicitlyOverridden: assumption.explicitlyOverridden,
          ...(assumption.currency ? { currency: assumption.currency } : {}),
          ...(assumption.period ? { period: assumption.period } : {}),
        });
      }
    },
  );

  it("SA-001G.12 keeps the hydration contract exhaustive for persisted calculation assumptions", () => {
    const supported = new Set(Object.keys(REANALYSIS_ASSUMPTION_CONTRACT));
    const golden = [
      ...buildSavedPurchaseAnalysis().assumptions!,
      ...buildSavedRentalAnalysis().assumptions!,
    ];

    expect(golden.filter(({ key }) => !supported.has(key))).toEqual([]);
    expect(new Set(golden.map(({ key }) => key))).toEqual(supported);
  });

  it("SA-001G.12 distinguishes explicit zero from null and from absence", async () => {
    const result = createPurchaseLifecycleResult();
    const snapshot = {
      ...buildOpportunityAnalysisSnapshot(result, savedAnalysisFixtureClock),
      assumptions: [
        {
          key: "monthly-utilities",
          value: 0,
          source: "user",
          unit: "currency" as const,
          currency: "USD" as const,
          period: "monthly" as const,
          explicitlyOverridden: true,
        },
        {
          key: "annual-insurance-premium",
          value: null,
          source: "system-default",
          unit: "currency" as const,
          currency: "USD" as const,
          period: "annual" as const,
        },
      ],
    };
    const repository = new InMemoryInvestmentOpportunityRepository();
    const { opportunity } = await createInvestmentOpportunityWithResult(repository, {
      authenticatedOwnerId: savedAnalysisFixtureIds.workspace,
      actor,
      route: "purchase",
      property: propertyFor(result),
      initialAnalysis: {
        lifecycleResult: result,
        lifecycleResultId: "zero-null",
        sourceSummary,
        snapshot,
        analyzedAt: savedAnalysisFixtureClock,
      },
    });
    const projection = await readImmutableAnalysis(repository, {
      ownerId: savedAnalysisFixtureIds.workspace,
      opportunityId: opportunity.id.value,
    });
    const hydrated = hydrateReanalysis(projection!, {
      workspaceId: savedAnalysisFixtureIds.workspace,
    });

    expect(hydrated.workspaceValues.monthlyUtilities).toBe(0);
    expect(hydrated.assumptions["annual-insurance-premium"].value).toBeNull();
    expect(hydrated.workspaceValues).not.toHaveProperty("annualInsurance");
  });
});

function propertyFor(
  result: ReturnType<typeof createPurchaseLifecycleResult> | ReturnType<typeof createRentalLifecycleResult>,
) {
  const subject = result.analysis.property;
  return {
    ...buildSubjectPropertyFixture(),
    marketPropertyId: subject.id,
    normalizedAddress: {
      address1: subject.location.address1,
      city: subject.location.city,
      state: subject.location.state,
      postalCode: subject.location.postalCode,
    },
  };
}
