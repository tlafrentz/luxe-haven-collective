import {
  describe,
  expect,
  it,
} from "vitest";

import {
  DecisionMode,
} from "@/platform/decisions";
import {
  LearningInsight,
  createLearningInsightId,
} from "@/platform/learning";
import {
  createOutcomeId,
  emptyOutcomeLineage,
} from "@/platform/outcomes";
import {
  ConfidenceAssessment,
  ConfidenceScore,
} from "@/platform/scoring";

import {
  AcquisitionType,
} from "../domain";
import {
  InvestmentLearningApplicationError,
  reviewInvestmentLearningApplication,
} from "./review-investment-learning-application";

import type {
  InvestmentLearningApplication,
  InvestmentLearningApplicationProposal,
  ReviewInvestmentLearningApplicationCommand,
} from "./types";

function learning({
  id = "learning-insurance",
  scopeKind = "subject",
  scope = "property-1",
  subjectId = "property-1",
}: {
  id?: string;
  scopeKind?: "subject" | "market" | "strategy" | "assumption-policy";
  scope?: string;
  subjectId?: string;
} = {}) {
  return LearningInsight.create({
    id: createLearningInsightId(id),
    title: "Insurance assumption contradicted",
    summary: "The confirmed premium exceeded underwriting.",
    type: "calibration",
    confidence: ConfidenceAssessment.create({
      score: ConfidenceScore.create(0.9),
      rationale: ["A written quote supports the finding."],
    }),
    explainability: {
      supportingOutcomeIds: [createOutcomeId(`outcome-${id}`)],
      supportingIntelligenceIds: [],
      lineage: emptyOutcomeLineage(),
      assumptions: ["Annual insurance premium"],
      rationale: ["Actual cost materially exceeded the assumption."],
    },
    metadata: {
      capability: "investment-intelligence",
      learningRunId: "learning-run-1",
      derivedAt: "2026-02-03T12:00:00.000Z",
      derivedByActorId: "deriving-actor",
      learningKind: "contradicted",
      scopeKind,
      scope,
      subjectId,
      acquisitionType: AcquisitionType.Purchase,
      investmentRunId: "investment-run-1",
      decisionId: "investment-decision-1",
      recommendationId: "investment-recommendation-1",
      executionPlanId: "investment-plan-1",
    },
  });
}

function proposal(
  overrides: Partial<InvestmentLearningApplicationProposal> = {},
): InvestmentLearningApplicationProposal {
  return {
    id: "proposal-1",
    status: "proposed",
    learningInsightIds: ["learning-insurance"],
    target: {
      kind: "subject-assumption",
      subjectId: "property-1",
      assumptionKey: "annual-insurance-premium",
    },
    mode: "replace-assumption",
    proposedValue: {
      value: 4800,
      unit: "USD",
    },
    rationale: "Use the confirmed quote for this property only.",
    evidenceSummary: "A completed insurance diligence action produced a written quote.",
    limitations: ["Quote expires after 30 days."],
    effectiveFrom: new Date("2026-02-05T12:00:00Z"),
    expiresAt: new Date("2026-03-05T12:00:00Z"),
    proposedBy: {
      id: "proposing-actor",
      displayName: "Proposal Owner",
    },
    proposedAt: new Date("2026-02-04T12:00:00Z"),
    ...overrides,
  };
}

function command(
  overrides: Partial<ReviewInvestmentLearningApplicationCommand> = {},
): ReviewInvestmentLearningApplicationCommand {
  return {
    proposal: proposal(),
    learnings: [learning()],
    disposition: "approve",
    rationale: "The evidence is sufficient and the scope is appropriately narrow.",
    reviewer: {
      id: "reviewing-actor",
      displayName: "Review Owner",
    },
    context: {
      reviewId: "review-1",
      decisionId: "learning-application-decision-1",
      applicationId: "learning-application-1",
      reviewedAt: new Date("2026-02-05T12:00:00Z"),
    },
    ...overrides,
  };
}

function errorCode(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof InvestmentLearningApplicationError
      ? error.code
      : undefined;
  }
  return undefined;
}

describe("reviewInvestmentLearningApplication", () => {
  it("records approval as a human Platform Decision and creates one immutable application", () => {
    const input = command();
    const result = reviewInvestmentLearningApplication(input);

    expect(result.review).toMatchObject({
      id: "review-1",
      proposalId: "proposal-1",
      disposition: "approve",
      reviewer: { id: "reviewing-actor" },
    });
    expect(result.review.decision).toMatchObject({
      outcome: "approved",
      mode: DecisionMode.HUMAN_APPROVED,
      metadata: {
        proposalId: "proposal-1",
        applicationId: "learning-application-1",
        proposedByActorId: "proposing-actor",
        reviewerActorId: "reviewing-actor",
        derivedByActorIds: ["deriving-actor"],
      },
    });
    expect(result.application).toMatchObject({
      id: "learning-application-1",
      version: 1,
      status: "approved",
      approvalDecisionId: "learning-application-decision-1",
      learningInsightIds: ["learning-insurance"],
      appliedValue: { value: 4800, unit: "USD" },
      approvedBy: { id: "reviewing-actor" },
      sourceSubjectIds: ["property-1"],
      sourceOutcomeIds: ["outcome-learning-insurance"],
      sourceInvestmentRunIds: ["investment-run-1"],
    });
    expect(Object.isFrozen(result.application)).toBe(true);
    expect(input.proposal.status).toBe("proposed");
  });

  it.each([
    ["reject", "rejected", DecisionMode.REJECTED],
    ["defer", "deferred", DecisionMode.DEFERRED],
  ] as const)("records %s without creating an active application", (disposition, outcome, mode) => {
    const result = reviewInvestmentLearningApplication(command({ disposition }));
    expect(result.review.decision.outcome).toBe(outcome);
    expect(result.review.decision.mode).toBe(mode);
    expect(result.application).toBeUndefined();
  });

  it("keeps deriving, proposing, and approving identities distinct", () => {
    const result = reviewInvestmentLearningApplication(command());
    expect(result.review.decision.metadata).toMatchObject({
      derivedByActorIds: ["deriving-actor"],
      proposedByActorId: "proposing-actor",
      reviewerActorId: "reviewing-actor",
    });
    expect(result.application?.approvedBy.id).toBe("reviewing-actor");
  });

  it("rejects duplicate, missing, or unrelated Learning selection", () => {
    expect(errorCode(() => reviewInvestmentLearningApplication(command({
      proposal: proposal({ learningInsightIds: [] }),
    })))).toBe("INVESTMENT_LEARNING_APPLICATION_LEARNINGS_EMPTY");
    expect(errorCode(() => reviewInvestmentLearningApplication(command({
      proposal: proposal({ learningInsightIds: ["learning-insurance", "learning-insurance"] }),
    })))).toBe("INVESTMENT_LEARNING_APPLICATION_DUPLICATE_LEARNING");
    expect(errorCode(() => reviewInvestmentLearningApplication(command({
      proposal: proposal({ learningInsightIds: ["unknown-learning"] }),
    })))).toBe("INVESTMENT_LEARNING_APPLICATION_LINEAGE_MISMATCH");
  });

  it("prevents subject evidence from being generalized to market policy", () => {
    expect(errorCode(() => reviewInvestmentLearningApplication(command({
      proposal: proposal({
        target: {
          kind: "market-assumption-candidate",
          marketId: "market-1",
          assumptionKey: "annual-insurance-premium",
        },
        mode: "policy-review-candidate",
        proposedValue: undefined,
      }),
    })))).toBe("INVESTMENT_LEARNING_APPLICATION_SCOPE_EXCEEDS_EVIDENCE");
  });

  it("allows broader candidates only when Learning already has matching governed scope", () => {
    const result = reviewInvestmentLearningApplication(command({
      proposal: proposal({
        target: {
          kind: "market-assumption-candidate",
          marketId: "market-1",
          assumptionKey: "annual-insurance-premium",
        },
        mode: "policy-review-candidate",
        proposedValue: undefined,
      }),
      learnings: [learning({ scopeKind: "market", scope: "market-1" })],
    }));
    expect(result.application?.target.kind).toBe("market-assumption-candidate");
  });

  it("enforces mode/value compatibility and effective-period ordering", () => {
    expect(errorCode(() => reviewInvestmentLearningApplication(command({
      proposal: proposal({ proposedValue: undefined }),
    })))).toBe("INVESTMENT_LEARNING_APPLICATION_VALUE_REQUIRED");
    expect(errorCode(() => reviewInvestmentLearningApplication(command({
      proposal: proposal({
        mode: "add-risk-context",
      }),
    })))).toBe("INVESTMENT_LEARNING_APPLICATION_VALUE_NOT_ALLOWED");
    expect(errorCode(() => reviewInvestmentLearningApplication(command({
      proposal: proposal({ expiresAt: new Date("2026-02-05T12:00:00Z") }),
    })))).toBe("INVESTMENT_LEARNING_APPLICATION_INVALID_DATES");
  });

  it("requires explicit, target-compatible supersession and versions the replacement", () => {
    const current = reviewInvestmentLearningApplication(command()).application as InvestmentLearningApplication;
    const existingApplications = [current];
    expect(errorCode(() => reviewInvestmentLearningApplication(command({
      context: { ...command().context, applicationId: "application-2", existingApplications },
    })))).toBe("INVESTMENT_LEARNING_APPLICATION_SUPERSESSION_REQUIRED");

    const result = reviewInvestmentLearningApplication(command({
      proposal: proposal({ supersedesApplicationId: current.id }),
      context: { ...command().context, applicationId: "application-2", decisionId: "decision-2", existingApplications },
    }));
    expect(result.application).toMatchObject({
      id: "application-2",
      version: 2,
      supersedesApplicationId: "learning-application-1",
    });
  });

  it("is deterministic for fixed identities and time without mutating source Learning", () => {
    const input = command();
    const sourceMetadata = { ...input.learnings[0].metadata };
    expect(reviewInvestmentLearningApplication(input)).toEqual(reviewInvestmentLearningApplication(input));
    expect(input.learnings[0].metadata).toEqual(sourceMetadata);
  });
});
