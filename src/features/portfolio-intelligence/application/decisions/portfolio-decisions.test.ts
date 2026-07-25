import { describe, expect, it, vi } from "vitest";
import { ConfidenceLevel } from "@/platform/scoring";
import { findingsQueryFixture } from "../findings/findings.test";
import { buildPortfolioFindings } from "../findings";
import {
  applyPortfolioDecisionCommand,
  buildDecisionExecutionPlan, buildPortfolioDecisionWorkspace,
  calculateCapitalReturn, createApprovedDecisionActions,
  createDecisionMeasurementPlan, createPortfolioDecision,
  detectCapitalConflicts, evaluateRecommendationStrength,
  getCapitalAllocationCandidates, PortfolioDecisionError,
  toCanonicalPlatformDecision,
} from ".";
import { InMemoryPortfolioDecisionRepository } from "../../infrastructure/in-memory-portfolio-decision-repository";

function fixture() {
  const findings = buildPortfolioFindings(findingsQueryFixture());
  const candidate = getCapitalAllocationCandidates(findings)[0];
  const decision = createPortfolioDecision({
    candidate, ownerProfileId: "profile-owner", evidence: findings.evidence,
    now: "2026-07-25T12:00:00Z",
  });
  return { findings, candidate, decision };
}

describe("PI-001F capital allocation and strategic decisions", () => {
  it("builds candidates from PI-001E findings without recreating findings", () => {
    const { findings } = fixture();
    const candidates = getCapitalAllocationCandidates(findings);
    expect(candidates.length).toBe(findings.prioritized.length);
    expect(candidates[0].sourceFindingIds).toEqual([findings.prioritized[0].id]);
    expect(candidates[0]).toMatchObject({
      status: "ready-for-review", recommendationStrength: expect.any(String),
      requestedResources: expect.any(Array), expectedImpact: { dimensions: expect.any(Array) },
    });
  });

  it("keeps candidates, recommendations, decisions, actions, and outcomes distinct", () => {
    const { candidate, decision } = fixture();
    expect(candidate.id).not.toBe(decision.decisionId);
    expect(candidate.status).toBe("ready-for-review");
    expect(decision.status).toBe("ready-for-review");
    expect(decision.canonicalDecisionId).toBeUndefined();
    expect(decision.expectedOutcomes[0]).toMatchObject({ measurementWindow: { minimumDays: 30 } });
  });

  it("always includes a baseline and transparent tradeoffs", () => {
    const { candidate } = fixture();
    expect(candidate.alternatives.length).toBeGreaterThanOrEqual(2);
    expect(candidate.alternatives.some(({ baseline }) => baseline)).toBe(true);
    expect(candidate.alternatives.every(({ tradeoffs }) => tradeoffs.length)).toBeTruthy();
  });

  it("calculates ROI and payback only with reliable supported ranges", () => {
    const impact = {
      dimensions: [{ dimension: "revenue" as const, value: { type: "range" as const, minimum: 10_000, maximum: 15_000, unit: "USD" }, expected: true as const }],
      basis: { type: "vendor-estimate" as const, description: "Bounded estimate." },
    };
    const result = calculateCapitalReturn([{ type: "capital-expense", cadence: "one-time", amount: { amount: 5_000, currency: "USD" }, description: "Project", estimated: true, confidence: ConfidenceLevel.MODERATE }], impact);
    expect(result.expectedRoi).toEqual({ minimum: 2, maximum: 3 });
    expect(result.paybackMonths).toEqual({ minimum: 4, maximum: 6 });
    expect(calculateCapitalReturn([], impact).expectedRoi).toBeNull();
  });

  it("centralizes readiness and recommendation strength", () => {
    expect(evaluateRecommendationStrength({ confidence: ConfidenceLevel.HIGH, material: true, dependenciesReady: true, fresh: true, complete: true })).toBe("strong-recommendation");
    expect(evaluateRecommendationStrength({ confidence: ConfidenceLevel.LOW, material: true, dependenciesReady: true, fresh: true, complete: true })).toBe("insufficient-evidence");
    expect(evaluateRecommendationStrength({ confidence: ConfidenceLevel.HIGH, material: true, dependenciesReady: true, fresh: false, complete: true })).toBe("monitor");
  });

  it("surfaces property conflicts and preserves capital states", () => {
    const { findings, candidate } = fixture();
    const duplicate = { ...candidate, id: `${candidate.id}:other` };
    expect(detectCapitalConflicts([candidate, duplicate])[0]).toMatchObject({ type: "property" });
    const workspace = buildPortfolioDecisionWorkspace({ findings, role: "owner" });
    expect(workspace.summary).toMatchObject({ committedCapital: null, spentCapital: null });
  });

  it("requires owner approval, a reviewed alternative, rationale, and review date", async () => {
    const { candidate, decision } = fixture();
    const repository = new InMemoryPortfolioDecisionRepository();
    repository.seed(decision);
    await expect(applyPortfolioDecisionCommand(repository, decision, candidate, {
      commandId: "approve-operator", type: "approve", expectedRevision: 1,
      actorProfileId: "operator", actorRole: "operator", occurredAt: "2026-07-26T12:00:00Z",
      selectedAlternativeId: candidate.alternatives[0].id, rationale: "Proceed.", reviewAt: "2026-10-25T12:00:00Z",
    })).rejects.toMatchObject({ code: "permission" });
    await expect(applyPortfolioDecisionCommand(repository, decision, candidate, {
      commandId: "approve-incomplete", type: "approve", expectedRevision: 1,
      actorProfileId: "owner", actorRole: "owner", occurredAt: "2026-07-26T12:00:00Z",
    })).rejects.toBeInstanceOf(PortfolioDecisionError);
  });

  it("approves idempotently and creates an immutable canonical Platform Decision", async () => {
    const { candidate, decision } = fixture();
    const repository = new InMemoryPortfolioDecisionRepository();
    repository.seed(decision);
    const command = {
      commandId: "approve-once", type: "approve" as const, expectedRevision: 1,
      actorProfileId: "owner", actorRole: "owner" as const, occurredAt: "2026-07-26T12:00:00Z",
      selectedAlternativeId: candidate.alternatives[0].id,
      rationale: "Expected benefit justifies bounded implementation risk.",
      reviewAt: "2026-10-25T12:00:00Z",
    };
    const approved = await applyPortfolioDecisionCommand(repository, decision, candidate, command);
    const replay = await applyPortfolioDecisionCommand(repository, decision, candidate, command);
    expect(replay).toEqual(approved);
    expect(approved).toMatchObject({ status: "approved", revision: 2, decidedByProfileId: "owner" });
    const canonical = toCanonicalPlatformDecision(approved);
    expect(canonical.mode).toBe("human-approved");
    expect(canonical.metadata.evidenceVersion).toBe(approved.evidenceVersion);
  });

  it("detects revision conflicts, expired recommendations, invalid assumptions, and dependencies", async () => {
    const { candidate, decision } = fixture();
    const repository = new InMemoryPortfolioDecisionRepository();
    repository.seed(decision);
    await expect(applyPortfolioDecisionCommand(repository, decision, candidate, {
      commandId: "stale", type: "defer", expectedRevision: 2,
      actorProfileId: "owner", actorRole: "owner", occurredAt: "2026-07-26T12:00:00Z",
    })).rejects.toMatchObject({ code: "concurrency" });
    await expect(applyPortfolioDecisionCommand(repository, decision, { ...candidate, expiresAt: "2026-07-25T12:00:00Z" }, {
      commandId: "expired", type: "defer", expectedRevision: 1,
      actorProfileId: "owner", actorRole: "owner", occurredAt: "2026-07-26T12:00:00Z",
    })).rejects.toMatchObject({ code: "expired" });
  });

  it("creates bounded Action Center lineage and a measurement plan after approval", async () => {
    const { candidate, decision } = fixture();
    const repository = new InMemoryPortfolioDecisionRepository();
    repository.seed(decision);
    const approved = await applyPortfolioDecisionCommand(repository, decision, candidate, {
      commandId: "approved-plan", type: "approve", expectedRevision: 1,
      actorProfileId: "owner", actorRole: "owner", occurredAt: "2026-07-26T12:00:00Z",
      selectedAlternativeId: candidate.alternatives[0].id, rationale: "Approve bounded plan.",
      reviewAt: "2026-10-25T12:00:00Z",
    });
    const provider = { createDraft: vi.fn(async (command) => command) };
    const plan = await createApprovedDecisionActions({
      decision: approved, provider: provider as never, actorProfileId: "owner",
      commandId: "handoff", occurredAt: "2026-07-26T12:00:00Z",
    });
    expect(plan.actions).toHaveLength(4);
    expect(provider.createDraft).toHaveBeenCalledTimes(4);
    expect(provider.createDraft.mock.calls[0][0].sources[0]).toMatchObject({ type: "decision", capability: "portfolio" });
    expect(createDecisionMeasurementPlan(approved)).toMatchObject({ ownerProfileId: "profile-owner", reviewAt: approved.reviewAt });
    expect(buildDecisionExecutionPlan(approved).editable).toBe(true);
  });
});

export { fixture as portfolioDecisionFixture };
