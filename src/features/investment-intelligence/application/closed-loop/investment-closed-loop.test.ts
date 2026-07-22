import {
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionType,
  buildInvestmentAnalysisContext,
  buildInvestmentAppliedLearningContext,
  reviewInvestmentLearningApplication,
  runInvestmentAnalysis,
} from "@/features/investment-intelligence";

import {
  assertClosedInvestmentLearningLineage,
} from "./assertions/assert-closed-investment-learning-lineage";
import {
  buildInvestmentClosedLoopFixture,
  snapshotHistory,
} from "./fixtures/build-investment-closed-loop-fixture";

import type {
  InvestmentLearningApplication,
} from "../types";

type Fixture = ReturnType<
  typeof buildInvestmentClosedLoopFixture
>;

let purchase: Fixture;
let rental: Fixture;

beforeAll(() => {
  purchase = buildInvestmentClosedLoopFixture("purchase");
  rental = buildInvestmentClosedLoopFixture("rental");
});

describe("Investment closed-loop lifecycle", () => {
  it("completes the purchase Run A to governed Run B lifecycle", () => {
    expect(purchase.runA.acquisitionType).toBe(AcquisitionType.Purchase);
    expect(purchase.runA.analysis.expenseProjection.insurance.amount).toBe(2400);
    expect(purchase.decision.outcome).toBe("accepted");
    expect(purchase.executionPlan.intents.map(({ key }) => key))
      .toContain("confirm-insurance-and-costs");
    expect(purchase.draftAction.status).toBe("draft");
    expect(purchase.outcomeResult.measurements[0]).toMatchObject({
      value: 4800,
      assumedValue: 2400,
      variance: 2400,
    });
    expect(purchase.learningResult.candidates[0]).toMatchObject({
      kind: "contradicted",
      confidenceImpact: { direction: "decrease", magnitude: "major" },
      policyImpact: { target: "expense-assumption", disposition: "review" },
    });
    expect(purchase.learningApplication).toMatchObject({
      mode: "replace-assumption",
      target: {
        kind: "subject-assumption",
        subjectId: "property-purchase",
        assumptionKey: "annual-insurance-premium",
      },
      appliedValue: { value: 4800 },
    });
    expect(purchase.analysisContext.input.acquisitionType).toBe(AcquisitionType.Purchase);
    if (purchase.analysisContext.input.acquisitionType === AcquisitionType.Purchase) {
      expect(purchase.analysisContext.input.operating.annualInsurance).toBe(4800);
    }
    expect(purchase.runB.analysis.expenseProjection.insurance.amount).toBe(4800);
    expect(purchase.runA.analysis.expenseProjection.insurance.amount).toBe(2400);
    expect(purchase.platformAnalysis.lineage.runId).toBe(purchase.runAId);
    expect(purchase.runBPlatformAnalysis.lineage.runId).toBe(purchase.runBId);
    expect(purchase.runBId).not.toBe(purchase.runAId);
  });

  it("completes the rental-arbitrage Run A to governed Run B lifecycle", () => {
    expect(rental.runA.acquisitionType).toBe(AcquisitionType.RentalArbitrage);
    expect(rental.runA.analysis.expenseProjection.utilities.amount).toBe(3600);
    expect(rental.executionPlan.intents.map(({ key }) => key))
      .toContain("confirm-utilities-responsibility");
    expect(rental.learningApplication.sourceAcquisitionTypes)
      .toEqual([AcquisitionType.RentalArbitrage]);
    expect(rental.appliedLearningContext.assumptionOverrides[0]).toMatchObject({
      assumptionKey: "monthly-utilities",
      appliedValue: { value: 475 },
    });
    expect(rental.analysisContext.input.acquisitionType).toBe(AcquisitionType.RentalArbitrage);
    if (rental.analysisContext.input.acquisitionType === AcquisitionType.RentalArbitrage) {
      expect(rental.analysisContext.input.operating.monthlyUtilities).toBe(475);
    }
    expect(rental.runB.analysis.expenseProjection.utilities.amount).toBe(5700);
    expect(rental.runA.analysis.expenseProjection.utilities.amount).toBe(3600);
    expect(rental.runBPlatformAnalysis.lineage.runId).toBe(rental.runBId);
  });

  it.each(["purchase", "rental"] as const)(
    "closes exact %s lineage from Run B context through Run A",
    (route) => assertClosedInvestmentLearningLineage(route === "purchase" ? purchase : rental),
  );

  it("preserves distinct execution, derivation, proposal, and approval actors", () => {
    expect(purchase.outcomeResult.outcome.metadata.recordedByActorId).toBe("execution-actor");
    expect(purchase.learningInsight.metadata.derivedByActorId).toBe("deriving-actor");
    expect(purchase.learningReview.decision.metadata.proposedByActorId).toBe("proposing-actor");
    expect(purchase.learningApplication.approvedBy.id).toBe("approving-actor");
    expect(new Set([
      purchase.outcomeResult.outcome.metadata.recordedByActorId,
      purchase.learningInsight.metadata.derivedByActorId,
      purchase.learningReview.decision.metadata.proposedByActorId,
      purchase.learningApplication.approvedBy.id,
    ]).size).toBe(4);
  });

  it("keeps Action completion distinct from unfavorable business disposition", () => {
    expect(purchase.completedAction.status).toBe("completed");
    expect(purchase.outcomeResult.outcome.successful).toBe(true);
    expect(purchase.outcomeResult.outcome.result.disposition).toBe("unfavorable");
    expect(purchase.draftAction.status).toBe("draft");
  });

  it("lets an explicit current user value override approved Learning", () => {
    const explicit = buildInvestmentClosedLoopFixture("purchase", {
      explicitRunBValue: 5200,
    });
    if (explicit.analysisContext.input.acquisitionType === AcquisitionType.Purchase) {
      expect(explicit.analysisContext.input.operating.annualInsurance).toBe(5200);
    }
    expect(explicit.runB.analysis.expenseProjection.insurance.amount).toBe(5200);
    expect(explicit.analysisContext.assumptions.find(({ key }) => key === "annual-insurance-premium"))
      .toMatchObject({ source: "user", value: 5200 });
  });

  it("treats populated legacy values as defaults unless provenance marks them explicit", () => {
    expect(purchase.input.acquisitionType).toBe(AcquisitionType.Purchase);
    if (purchase.input.acquisitionType === AcquisitionType.Purchase) {
      expect(purchase.input.operating.annualInsurance).toBe(2400);
    }
    expect(purchase.analysisContext.assumptions.find(({ key }) => key === "annual-insurance-premium"))
      .toMatchObject({ source: "applied-learning", value: 4800 });
  });

  it("materializes a system default when neither user nor Learning supplies it", () => {
    const context = buildInvestmentAnalysisContext({
      input: purchase.input,
      userProvidedAssumptionKeys: [],
    });
    expect(context.input.revenue.confidencePercentage).toBe(80);
    expect(context.assumptions.find(({ key }) => key === "revenue-confidence-percentage"))
      .toMatchObject({ source: "system-default", value: 80 });
  });

  it("preserves historical artifacts and source input after Run B", () => {
    expect(snapshotHistory({
      input: purchase.input,
      runA: purchase.runA,
      platformAnalysis: purchase.platformAnalysis,
      recommendation: purchase.recommendation,
      decision: purchase.decision,
      executionPlan: purchase.executionPlan,
      draftAction: purchase.draftAction,
      completedAction: purchase.completedAction,
      outcome: purchase.outcomeResult.outcome,
      learningInsight: purchase.learningInsight,
      learningApplication: purchase.learningApplication,
    })).toBe(purchase.historyBeforeRunB);
    expect(purchase.runB).not.toBe(purchase.runA);
    expect(purchase.learningApplication.status).toBe("approved");
  });

  it("replays context selection, composition, Run B, and Platform projection deterministically", () => {
    const replay = buildInvestmentClosedLoopFixture("purchase");
    expect(replay.appliedLearningContext).toEqual(purchase.appliedLearningContext);
    expect(replay.analysisContext).toEqual(purchase.analysisContext);
    expect(replay.runB).toEqual(purchase.runB);
    expect(replay.runBPlatformAnalysis).toEqual(purchase.runBPlatformAnalysis);
  });
});

describe("closed-loop governance exclusions", () => {
  function select(applications: readonly InvestmentLearningApplication[], route = AcquisitionType.Purchase) {
    return buildInvestmentAppliedLearningContext({
      subjectId: "property-purchase",
      acquisitionType: route,
      marketId: "mesa",
      applications,
      analysisDate: new Date("2026-04-05T08:00:00Z"),
    });
  }

  it.each([
    ["applied", "applied"],
    ["expired", "expired"],
    ["superseded", "superseded"],
  ] as const)("excludes %s application state", (_label, status) => {
    expect(select([{ ...purchase.learningApplication, status }]).applicationIds).toEqual([]);
  });

  it("canonical rejected and deferred reviews create no application", () => {
    for (const disposition of ["reject", "defer"] as const) {
      const result = reviewInvestmentLearningApplication({
        proposal: {
          id: `proposal-${disposition}`,
          status: "proposed",
          learningInsightIds: [purchase.learningInsight.id.value],
          target: { kind: "subject-assumption", subjectId: "property-purchase", assumptionKey: "annual-insurance-premium" },
          mode: "replace-assumption",
          proposedValue: { value: 4800, unit: "USD" },
          rationale: "Governed review.",
          evidenceSummary: "Measured insurance quote.",
          limitations: ["Subject only."],
          effectiveFrom: new Date("2026-04-04T08:00:00Z"),
          proposedBy: { id: "proposer" },
          proposedAt: new Date("2026-04-03T09:00:00Z"),
        },
        learnings: [purchase.learningInsight],
        disposition,
        rationale: "Not approved for use.",
        reviewer: { id: "reviewer" },
        context: {
          reviewId: `review-${disposition}`,
          decisionId: `decision-${disposition}`,
          applicationId: `application-${disposition}`,
          reviewedAt: new Date("2026-04-04T08:00:00Z"),
        },
      });
      expect(result.application).toBeUndefined();
      expect(result.review.decision.outcome).toBe(disposition === "reject" ? "rejected" : "deferred");
    }
  });

  it("excludes future, expired, wrong-subject, and wrong-route applications", () => {
    const base = purchase.learningApplication;
    expect(select([{ ...base, effectiveFrom: new Date("2026-04-06T08:00:00Z") }]).applicationIds).toEqual([]);
    expect(select([{ ...base, expiresAt: new Date("2026-04-05T08:00:00Z") }]).applicationIds).toEqual([]);
    expect(buildInvestmentAppliedLearningContext({
      subjectId: "another-property",
      acquisitionType: AcquisitionType.Purchase,
      applications: [base],
      analysisDate: new Date("2026-04-05T08:00:00Z"),
    }).applicationIds).toEqual([]);
    expect(select([base], AcquisitionType.RentalArbitrage).applicationIds).toEqual([]);
  });

  it("prevents purchase and rental applications from cross-applying", () => {
    expect(buildInvestmentAppliedLearningContext({
      subjectId: "property-rental",
      acquisitionType: AcquisitionType.RentalArbitrage,
      applications: [purchase.learningApplication],
      analysisDate: new Date("2026-04-05T08:00:00Z"),
    }).applicationIds).toEqual([]);
    expect(buildInvestmentAppliedLearningContext({
      subjectId: "property-purchase",
      acquisitionType: AcquisitionType.Purchase,
      applications: [rental.learningApplication],
      analysisDate: new Date("2026-04-05T08:00:00Z"),
    }).applicationIds).toEqual([]);
  });

  it("retains established stable failures for duplicate IDs, missing lineage, and equal precedence", () => {
    const base = purchase.learningApplication;
    expect(() => select([base, base])).toThrowError(expect.objectContaining({
      code: "INVESTMENT_APPLIED_LEARNING_DUPLICATE_APPLICATION",
    }));
    expect(() => select([{ ...base, sourceOutcomeIds: [] }])).toThrowError(expect.objectContaining({
      code: "INVESTMENT_APPLIED_LEARNING_LINEAGE_MISSING",
    }));
    expect(() => select([
      base,
      { ...base, id: "equal-application", learningInsightIds: ["equal-learning"], sourceOutcomeIds: ["equal-outcome"] },
    ])).toThrowError(expect.objectContaining({
      code: "INVESTMENT_APPLIED_LEARNING_CONFLICT",
    }));
  });

  it("preserves supporting context without changing analysis policy", () => {
    const applied = {
      ...purchase.appliedLearningContext,
      constraints: [
        { key: "str-permission", description: "Written approval required.", applicationId: purchase.learningApplication.id },
        { key: "str-permission", description: "Written approval required.", applicationId: purchase.learningApplication.id },
      ],
      resolvedDataGaps: ["hoa-approval", "hoa-approval"],
      persistentRisks: [
        { key: "repairs", description: "Repairs were historically understated.", severity: "material" as const, applicationId: purchase.learningApplication.id },
      ],
    };
    const context = buildInvestmentAnalysisContext({
      input: purchase.input,
      userProvidedAssumptionKeys: [],
      appliedLearning: applied,
    });
    expect(context.constraints).toHaveLength(1);
    expect(context.resolvedDataGaps).toEqual(["hoa-approval"]);
    expect(context.persistentRiskContext[0]).toMatchObject({ key: "repairs", severity: "material" });
    expect(runInvestmentAnalysis(context.input).analysis.score.overall.value)
      .toBe(purchase.runB.analysis.score.overall.value);
  });
});
