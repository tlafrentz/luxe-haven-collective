import { Result } from "@/platform/kernel";
import { describe, expect, it, vi } from "vitest";
import { createOutcomeOwnerId } from "../../outcomes";
import { t } from "../../outcomes/domain/outcome.test-support";
import { createPortfolioLearningAssessmentId, DEFAULT_PORTFOLIO_LEARNING_POLICY } from "../domain";
import { InMemoryPortfolioLearningAssessmentRepository } from "../infrastructure";
import { evaluatePortfolioLearningService } from "./evaluate-portfolio-learning-service";

const ownerId = createOutcomeOwnerId("owner-1");
const portfolio = Object.freeze({
  portfolioId: "portfolio-1", ownerId, portfolioVersion: 2, lifecycleStage: "operating" as const,
  propertyReferences: Object.freeze([]), strategyReferences: Object.freeze([]),
  assessmentContexts: Object.freeze([]), capturedAt: t(1),
});
const query = () => ({
  ownerId, portfolioId: "portfolio-1", assessmentId: createPortfolioLearningAssessmentId("learning-assessment-1"),
  observationWindow: { start: t(1), end: t(14) }, evaluatedAt: t(14), expectedVersion: null,
});
const dependencies = () => ({
  authorization: { canEvaluate: async () => true },
  portfolios: { readPortfolio: async () => Result.ok(portfolio) },
  decisionOutcomes: { readEligible: async () => Result.ok([]) },
  recommendationEffectiveness: { readEligible: async () => Result.ok([]) },
  policies: { get: () => DEFAULT_PORTFOLIO_LEARNING_POLICY },
  repository: new InMemoryPortfolioLearningAssessmentRepository(),
});

describe("LI-004 Portfolio Learning application service", () => {
  it("authorizes before sensitive portfolio and assessment reads", async () => {
    const portfolios = { readPortfolio: vi.fn(async () => Result.ok(portfolio)) };
    const result = await evaluatePortfolioLearningService({
      ...dependencies(), portfolios, authorization: { canEvaluate: async () => false },
    }, query());
    expect(result).toMatchObject({ isFailure: true, error: { code: "PORTFOLIO_LEARNING_NOT_AUTHORIZED" } });
    expect(portfolios.readPortfolio).not.toHaveBeenCalled();
  });

  it("uses policy bounds, invokes the pure engine, and persists an immutable assessment", async () => {
    const decisionOutcomes = { readEligible: vi.fn(async () => Result.ok([])) };
    const effectiveness = { readEligible: vi.fn(async () => Result.ok([])) };
    const deps = { ...dependencies(), decisionOutcomes, recommendationEffectiveness: effectiveness };
    const result = await evaluatePortfolioLearningService(deps, query());
    expect(result.isSuccess && result.value.snapshotFingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(decisionOutcomes.readEligible).toHaveBeenCalledWith(ownerId, "portfolio-1", query().observationWindow, 500);
    expect(effectiveness.readEligible).toHaveBeenCalledWith(ownerId, "portfolio-1", query().observationWindow, 100);
    const stored = await deps.repository.findLatest(ownerId, "portfolio-1");
    expect(stored.isSuccess && stored.value?.version).toBe(1);
  });

  it("degrades optional Recommendation Effectiveness unavailability visibly", async () => {
    const result = await evaluatePortfolioLearningService({
      ...dependencies(), recommendationEffectiveness: { readEligible: async () => Result.fail({ code: "UNAVAILABLE", retryable: true }) },
    }, query());
    expect(result.isSuccess && result.value.limitations).toContainEqual(expect.objectContaining({ code: "LEARNING_SOURCE_UNAVAILABLE" }));
  });

  it("maps missing portfolio and enforces optimistic history", async () => {
    const missing = await evaluatePortfolioLearningService({ ...dependencies(), portfolios: { readPortfolio: async () => Result.ok(null) } }, query());
    expect(missing).toMatchObject({ isFailure: true, error: { code: "PORTFOLIO_LEARNING_NOT_FOUND" } });
    const deps = dependencies();
    expect((await evaluatePortfolioLearningService(deps, query())).isSuccess).toBe(true);
    const stale = await evaluatePortfolioLearningService(deps, { ...query(), assessmentId: createPortfolioLearningAssessmentId("learning-assessment-2") });
    expect(stale).toMatchObject({ isFailure: true, error: { code: "PORTFOLIO_LEARNING_VERSION_CONFLICT", currentVersion: 1 } });
    const next = await evaluatePortfolioLearningService(deps, { ...query(), assessmentId: createPortfolioLearningAssessmentId("learning-assessment-2"), expectedVersion: 1 });
    expect(next.isSuccess && next.value.version).toBe(2);
    expect(await deps.repository.findLatest(createOutcomeOwnerId("other"), "portfolio-1")).toMatchObject({ isSuccess: true, value: null });
  });
});
