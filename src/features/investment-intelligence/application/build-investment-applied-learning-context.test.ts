import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionType,
} from "../domain";
import {
  buildInvestmentAppliedLearningContext,
  InvestmentAppliedLearningContextError,
} from "./build-investment-applied-learning-context";

import type {
  BuildInvestmentAppliedLearningContextCommand,
  InvestmentLearningApplication,
} from "./types";

const ANALYSIS_DATE = new Date("2026-03-01T12:00:00Z");

function application(
  overrides: Partial<InvestmentLearningApplication> = {},
): InvestmentLearningApplication {
  return {
    id: "application-insurance",
    version: 1,
    status: "approved",
    approvalDecisionId: "decision-learning-application",
    learningInsightIds: ["learning-insurance"],
    target: {
      kind: "subject-assumption",
      subjectId: "property-1",
      assumptionKey: "annual-insurance-premium",
    },
    mode: "replace-assumption",
    previousValue: { value: 2400, unit: "USD" },
    appliedValue: { value: 4800, unit: "USD" },
    rationale: "Use the confirmed insurance quote.",
    limitations: ["The quote is property-specific."],
    approvedBy: { id: "reviewer-1" },
    approvedAt: new Date("2026-02-10T12:00:00Z"),
    effectiveFrom: new Date("2026-02-10T12:00:00Z"),
    expiresAt: new Date("2026-04-01T12:00:00Z"),
    sourceSubjectIds: ["property-1"],
    sourceOutcomeIds: ["outcome-insurance"],
    sourceInvestmentRunIds: ["investment-run-a"],
    sourceAcquisitionTypes: [AcquisitionType.Purchase],
    ...overrides,
  };
}

function command(
  applications: readonly InvestmentLearningApplication[],
  overrides: Partial<BuildInvestmentAppliedLearningContextCommand> = {},
): BuildInvestmentAppliedLearningContextCommand {
  return {
    subjectId: "property-1",
    acquisitionType: AcquisitionType.Purchase,
    marketId: "market-1",
    applications,
    analysisDate: ANALYSIS_DATE,
    ...overrides,
  };
}

function errorCode(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof InvestmentAppliedLearningContextError
      ? error.code
      : undefined;
  }
  return undefined;
}

describe("buildInvestmentAppliedLearningContext", () => {
  describe("eligibility", () => {
    it("includes an approved application effective on the analysis date", () => {
      const item = application({ effectiveFrom: ANALYSIS_DATE });
      expect(buildInvestmentAppliedLearningContext(command([item])).applicationIds)
        .toEqual([item.id]);
    });

    it.each(["applied", "expired", "superseded"] as const)(
      "excludes an application in %s state",
      (status) => {
        expect(buildInvestmentAppliedLearningContext(command([
          application({ status }),
        ])).applicationIds).toEqual([]);
      },
    );

    it("excludes future and expired effective periods with an exclusive expiration boundary", () => {
      const future = application({
        id: "future",
        effectiveFrom: new Date("2026-03-02T12:00:00Z"),
      });
      const expired = application({
        id: "expired-by-time",
        expiresAt: ANALYSIS_DATE,
      });
      expect(buildInvestmentAppliedLearningContext(command([future, expired])).applicationIds)
        .toEqual([]);
    });

    it("rejects an approved application without an explicit effective date", () => {
      expect(errorCode(() => buildInvestmentAppliedLearningContext(command([
        application({ effectiveFrom: undefined }),
      ])))).toBe("INVESTMENT_APPLIED_LEARNING_EFFECTIVE_DATE_MISSING");
    });

    it("removes an explicitly superseded application even when its immutable status remains approved", () => {
      const old = application({ id: "old-application" });
      const replacement = application({
        id: "replacement-application",
        approvedAt: new Date("2026-02-20T12:00:00Z"),
        effectiveFrom: new Date("2026-02-20T12:00:00Z"),
        supersedesApplicationId: old.id,
      });
      expect(buildInvestmentAppliedLearningContext(command([old, replacement])).applicationIds)
        .toEqual([replacement.id]);
    });
  });

  describe("scope", () => {
    it("applies subject scope only to the same property", () => {
      expect(buildInvestmentAppliedLearningContext(command([application()], {
        subjectId: "property-2",
      })).applicationIds).toEqual([]);
    });

    it("requires source route lineage to include the requested acquisition route", () => {
      expect(buildInvestmentAppliedLearningContext(command([
        application({ sourceAcquisitionTypes: [AcquisitionType.RentalArbitrage] }),
      ])).applicationIds).toEqual([]);
    });

    it("applies a subject strategy constraint only to the same route", () => {
      const strategy = application({
        id: "strategy-constraint",
        target: {
          kind: "subject-strategy",
          subjectId: "property-1",
          acquisitionType: AcquisitionType.Purchase,
        },
        mode: "add-constraint",
        previousValue: undefined,
        appliedValue: undefined,
      });
      expect(buildInvestmentAppliedLearningContext(command([strategy])).constraints)
        .toHaveLength(1);
      expect(buildInvestmentAppliedLearningContext(command([strategy], {
        acquisitionType: AcquisitionType.RentalArbitrage,
      })).constraints).toEqual([]);
    });

    it("requires an explicitly matching market for market-scoped candidates", () => {
      const market = application({
        id: "market-candidate",
        target: {
          kind: "market-assumption-candidate",
          marketId: "market-1",
          assumptionKey: "occupancy",
        },
        mode: "calibration-candidate",
        previousValue: undefined,
        appliedValue: undefined,
      });
      const matching = buildInvestmentAppliedLearningContext(command([market]));
      const missing = buildInvestmentAppliedLearningContext(command([market], { marketId: undefined }));
      expect(matching).toEqual(missing);
      expect(matching.applicationIds).toEqual([]);
    });

    it("rejects malformed targets instead of widening them", () => {
      expect(errorCode(() => buildInvestmentAppliedLearningContext(command([
        application({
          target: { kind: "subject-assumption", subjectId: "", assumptionKey: "insurance" },
        }),
      ])))).toBe("INVESTMENT_APPLIED_LEARNING_SCOPE_INVALID");
    });

    it("rejects a subject target absent from approved source lineage", () => {
      expect(errorCode(() => buildInvestmentAppliedLearningContext(command([
        application({ sourceSubjectIds: ["property-2"] }),
      ])))).toBe("INVESTMENT_APPLIED_LEARNING_SCOPE_INVALID");
    });
  });

  describe("projection", () => {
    it("projects replacement and adjustment metadata without calculating values", () => {
      const replacement = application();
      const adjustment = application({
        id: "application-setup-adjustment",
        target: {
          kind: "subject-assumption",
          subjectId: "property-1",
          assumptionKey: "setup-cost",
        },
        mode: "adjust-assumption",
        previousValue: { value: 10000, unit: "USD" },
        appliedValue: { value: 2500, unit: "USD" },
      });
      expect(buildInvestmentAppliedLearningContext(command([adjustment, replacement])).assumptionOverrides)
        .toEqual([
          {
            assumptionKey: "annual-insurance-premium",
            operation: "replace",
            previousValue: { value: 2400, unit: "USD" },
            appliedValue: { value: 4800, unit: "USD" },
            applicationId: "application-insurance",
            rationale: "Use the confirmed insurance quote.",
          },
          expect.objectContaining({
            assumptionKey: "setup-cost",
            operation: "adjust",
            appliedValue: { value: 2500, unit: "USD" },
          }),
        ]);
    });

    it("projects constraints, resolved gaps, and persistent risk independently", () => {
      const constraint = application({
        id: "constraint",
        mode: "add-constraint",
        previousValue: undefined,
        appliedValue: undefined,
        rationale: "STR operation is prohibited.",
      });
      const gap = application({
        id: "gap",
        target: { kind: "subject-assumption", subjectId: "property-1", assumptionKey: "landlord-permission" },
        mode: "resolve-data-gap",
        previousValue: undefined,
        appliedValue: undefined,
      });
      const risk = application({
        id: "risk",
        target: { kind: "subject-assumption", subjectId: "property-1", assumptionKey: "repair-reserve" },
        mode: "add-risk-context",
        previousValue: undefined,
        appliedValue: undefined,
        riskSeverity: "material",
        rationale: "Repairs were historically underestimated.",
      });
      const result = buildInvestmentAppliedLearningContext(command([risk, gap, constraint]));
      expect(result.constraints).toEqual([{
        key: "annual-insurance-premium",
        description: "STR operation is prohibited.",
        applicationId: "constraint",
      }]);
      expect(result.resolvedDataGaps).toEqual(["landlord-permission"]);
      expect(result.persistentRisks).toEqual([{
        key: "repair-reserve",
        description: "Repairs were historically underestimated.",
        severity: "material",
        applicationId: "risk",
      }]);
    });

    it.each(["calibration-candidate", "policy-review-candidate"] as const)(
      "does not project the future-governance mode %s",
      (mode) => {
        const candidate = application({
          id: mode,
          target: mode === "calibration-candidate"
            ? { kind: "confidence-calibration-candidate", capability: "investment-intelligence", dimension: "comparable-confidence" }
            : { kind: "execution-policy-candidate", acquisitionType: AcquisitionType.Purchase, policyKey: "permission-order" },
          mode,
          previousValue: undefined,
          appliedValue: undefined,
        });
        expect(buildInvestmentAppliedLearningContext(command([candidate])).applicationIds)
          .toEqual([]);
      },
    );

    it("rejects missing value or risk severity rather than synthesizing business data", () => {
      expect(errorCode(() => buildInvestmentAppliedLearningContext(command([
        application({ appliedValue: undefined }),
      ])))).toBe("INVESTMENT_APPLIED_LEARNING_INVALID_APPLICATION");
      expect(errorCode(() => buildInvestmentAppliedLearningContext(command([
        application({ mode: "add-risk-context", previousValue: undefined, appliedValue: undefined }),
      ])))).toBe("INVESTMENT_APPLIED_LEARNING_INVALID_APPLICATION");
    });
  });

  describe("conflict resolution", () => {
    it("selects the newest approval for the same projected key", () => {
      const older = application({ id: "older", appliedValue: { value: 4000, unit: "USD" } });
      const newer = application({
        id: "newer",
        approvedAt: new Date("2026-02-20T12:00:00Z"),
        effectiveFrom: new Date("2026-02-20T12:00:00Z"),
        appliedValue: { value: 4800, unit: "USD" },
      });
      const result = buildInvestmentAppliedLearningContext(command([older, newer]));
      expect(result.applicationIds).toEqual(["newer"]);
      expect(result.assumptionOverrides[0].appliedValue.value).toBe(4800);
    });

    it("rejects an unresolved tie rather than silently keeping duplicate overrides", () => {
      expect(errorCode(() => buildInvestmentAppliedLearningContext(command([
        application({ id: "first" }),
        application({ id: "second" }),
      ])))).toBe("INVESTMENT_APPLIED_LEARNING_CONFLICT");
    });

    it("rejects duplicate application IDs before precedence", () => {
      expect(errorCode(() => buildInvestmentAppliedLearningContext(command([
        application(),
        application(),
      ])))).toBe("INVESTMENT_APPLIED_LEARNING_DUPLICATE_APPLICATION");
    });
  });

  describe("lineage, determinism, and purity", () => {
    it("preserves the complete approved lineage for every applied application", () => {
      expect(buildInvestmentAppliedLearningContext(command([application()])).lineage)
        .toEqual([{
          applicationId: "application-insurance",
          learningInsightIds: ["learning-insurance"],
          outcomeIds: ["outcome-insurance"],
          investmentRunIds: ["investment-run-a"],
          approvalDecisionId: "decision-learning-application",
        }]);
    });

    it.each([
      ["learningInsightIds", []],
      ["sourceOutcomeIds", []],
      ["sourceInvestmentRunIds", []],
      ["sourceSubjectIds", []],
      ["sourceAcquisitionTypes", []],
      ["approvalDecisionId", ""],
    ] as const)("rejects missing %s lineage", (field, value) => {
      expect(errorCode(() => buildInvestmentAppliedLearningContext(command([
        application({ [field]: value }),
      ])))).toBe("INVESTMENT_APPLIED_LEARNING_LINEAGE_MISSING");
    });

    it("returns stable sorted output for identical applications in any order", () => {
      const first = application();
      const second = application({
        id: "application-setup",
        target: { kind: "subject-assumption", subjectId: "property-1", assumptionKey: "setup-cost" },
        appliedValue: { value: 12000, unit: "USD" },
      });
      const forward = buildInvestmentAppliedLearningContext(command([first, second]));
      const reverse = buildInvestmentAppliedLearningContext(command([second, first]));
      expect(forward).toEqual(reverse);
      expect(forward.applicationIds).toEqual(["application-insurance", "application-setup"]);
      expect(forward.assumptionOverrides.map(({ assumptionKey }) => assumptionKey))
        .toEqual(["annual-insurance-premium", "setup-cost"]);
    });

    it("does not mutate applications and returns deeply frozen context", () => {
      const item = application();
      const before = structuredClone(item);
      const result = buildInvestmentAppliedLearningContext(command([item]));
      expect(item).toEqual(before);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.assumptionOverrides)).toBe(true);
      expect(Object.isFrozen(result.assumptionOverrides[0].appliedValue)).toBe(true);
    });
  });
});
