import { describe, expect, it } from "vitest";

import {
  Claim,
  ClaimCollection,
  ClaimStatus,
  createClaimId,
} from "../../claims";
import { EvidenceCollection } from "../../evidence";
import {
  ConfidenceAssessment,
  ConfidenceLevel,
  ConfidenceScore,
} from "../../scoring";
import {
  EvaluationDisposition,
  createEvaluationId,
} from "../domain";
import { EvaluationOrchestrator } from "./evaluation-orchestrator";
import { EvaluationPolicyRegistry } from "./evaluation-policy-registry";
import type { EvaluationPolicy } from "./evaluation-policy";

function claim(id: string, type: string): Claim {
  return Claim.create({
    id: createClaimId(id),
    type,
    subject: { type: "property", id: "property-001" },
    statement: `Statement for ${id}.`,
    status: ClaimStatus.ACTIVE,
    source: { capability: "market-intelligence", name: "claim-policy" },
    createdAt: new Date("2026-07-19T18:00:00.000Z"),
  });
}

function policy(
  name: string,
  supportedType: string,
  evaluate: EvaluationPolicy["evaluate"] = () => ({
    type: "market.demand-quality",
    disposition: EvaluationDisposition.SUPPORTED,
    summary: "Evidence supports the Claim.",
    confidence: ConfidenceAssessment.create({
      score: ConfidenceScore.create(80),
      level: ConfidenceLevel.HIGH,
      rationale: ["Evidence is sufficient."],
    }),
    evidenceReferences: [],
  }),
): EvaluationPolicy {
  return {
    name,
    version: "1",
    supports: ({ claim: candidate }) => candidate.type === supportedType,
    evaluate,
  };
}

describe("EvaluationOrchestrator", () => {
  it("evaluates every Claim supported by exactly one policy", () => {
    const moments = [
      "2026-07-19T20:00:00.000Z",
      "2026-07-19T20:00:01.000Z",
      "2026-07-19T20:00:02.000Z",
      "2026-07-19T20:00:03.000Z",
    ];
    const orchestrator = new EvaluationOrchestrator(
      EvaluationPolicyRegistry.create([
        policy("demand-policy", "market.demand"),
        policy("supply-policy", "market.supply"),
      ]),
    );

    const session = orchestrator.execute({
      claims: ClaimCollection.create([
        claim("claim-demand", "market.demand"),
        claim("claim-supply", "market.supply"),
      ]),
      evidence: EvidenceCollection.empty(),
      sourceCapability: "market-intelligence",
      now: () => new Date(moments.shift()!),
      createEvaluationId: (claimId) =>
        createEvaluationId(`evaluation-${claimId}`),
    });

    expect(session.claimsProcessed).toBe(2);
    expect(session.evaluationsCreated).toBe(2);
    expect(session.claimsSkipped).toBe(0);
    expect(session.claimsFailed).toBe(0);
    expect(session.succeeded).toBe(true);
    expect(session.durationMs).toBe(3000);
    expect(session.evaluationCollection.size).toBe(2);
    expect(
      session.evaluationCollection.toArray()[0].source.name,
    ).toBe("demand-policy");
  });

  it("records unsupported Claims as skipped and continues", () => {
    const session = new EvaluationOrchestrator(
      EvaluationPolicyRegistry.create([
        policy("demand-policy", "market.demand"),
      ]),
    ).execute({
      claims: ClaimCollection.create([
        claim("claim-unsupported", "market.supply"),
        claim("claim-demand", "market.demand"),
      ]),
      evidence: EvidenceCollection.empty(),
      sourceCapability: "market-intelligence",
      createEvaluationId: (claimId) =>
        createEvaluationId(`evaluation-${claimId}`),
    });

    expect(session.evaluationsCreated).toBe(1);
    expect(session.claimsSkipped).toBe(1);
    expect(session.diagnostics.skippedClaims).toEqual([
      "claim-unsupported",
    ]);
    expect(session.diagnostics.warnings[0]).toContain(
      "No Evaluation policy supports Claim",
    );
  });

  it("records ambiguous and failed evaluations and processes later Claims", () => {
    const throwingPolicy = policy(
      "throwing-policy",
      "market.failure",
      () => {
        throw new Error("Policy could not calculate confidence.");
      },
    );
    const session = new EvaluationOrchestrator(
      EvaluationPolicyRegistry.create([
        policy("first-demand-policy", "market.demand"),
        policy("second-demand-policy", "market.demand"),
        throwingPolicy,
        policy("supply-policy", "market.supply"),
      ]),
    ).execute({
      claims: ClaimCollection.create([
        claim("claim-ambiguous", "market.demand"),
        claim("claim-failure", "market.failure"),
        claim("claim-supply", "market.supply"),
      ]),
      evidence: EvidenceCollection.empty(),
      sourceCapability: "market-intelligence",
      createEvaluationId: (claimId) =>
        createEvaluationId(`evaluation-${claimId}`),
    });

    expect(session.evaluationsCreated).toBe(1);
    expect(session.claimsFailed).toBe(2);
    expect(session.succeeded).toBe(false);
    expect(session.diagnostics.failedClaims).toEqual([
      "claim-ambiguous",
      "claim-failure",
    ]);
    expect(session.diagnostics.errors).toHaveLength(2);
    expect(session.diagnostics.errors[1]).toContain(
      "Policy could not calculate confidence.",
    );
  });

  it("requires a registry and source capability", () => {
    const input = {
      claims: ClaimCollection.empty(),
      evidence: EvidenceCollection.empty(),
      sourceCapability: "market-intelligence",
    };

    expect(() => new EvaluationOrchestrator().execute(input)).toThrow(
      "An Evaluation policy registry is required.",
    );
    expect(() =>
      new EvaluationOrchestrator(EvaluationPolicyRegistry.empty()).execute({
        ...input,
        sourceCapability: "  ",
      }),
    ).toThrow("Evaluation source capability cannot be empty.");
  });
});
