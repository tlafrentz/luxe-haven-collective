import {
  describe,
  expect,
  it,
} from "vitest";

import {
  Claim,
  ClaimStatus,
  createClaimId,
} from "../../claims";

import {
  ConfidenceAssessment,
  ConfidenceLevel,
  ConfidenceScore,
} from "../../scoring";

import {
  EvaluationDisposition,
  EvaluationEvidenceRole,
  createEvaluationId,
} from "../domain";

import {
  EvaluationBuilder,
} from "./evaluation-builder";

function createClaim(): Claim {
  return Claim.create({
    id:
      createClaimId(
        "claim-return",
      ),
    type:
      "investment.return",
    subject: {
      type:
        "property",
      id:
        "property-001",
    },
    statement:
      "Projected return is below the target.",
    status:
      ClaimStatus.ACTIVE,
    source: {
      capability:
        "investment-intelligence",
      name:
        "return-claim-policy",
    },
    createdAt:
      new Date(
        "2026-07-19T18:00:00.000Z",
      ),
  });
}

describe(
  "EvaluationBuilder",
  () => {
    it(
      "builds a canonical Evaluation from a policy result",
      () => {
        const builder =
          new EvaluationBuilder();

        const evaluation =
          builder.build({
            id:
              createEvaluationId(
                "evaluation-return",
              ),
            claim:
              createClaim(),
            result: {
              type:
                "investment.return-quality",
              disposition:
                EvaluationDisposition.SUPPORTED,
              summary:
                "Evidence supports the below-target return Claim.",
              confidence:
                ConfidenceAssessment.create({
                  score:
                    ConfidenceScore.create(
                      91,
                    ),
                  level:
                    ConfidenceLevel.VERY_HIGH,
                  rationale: [
                    "Strong Evidence coverage.",
                  ],
                }),
              evidenceReferences: [
                {
                  evidenceId:
                    "evidence-return",
                  role:
                    EvaluationEvidenceRole.SUPPORTING,
                  weight: 0.82,
                },
              ],
              metadata: {
                policyThreshold:
                  0.12,
                ignoredFunction:
                  () => true,
              },
            },
            source: {
              capability:
                "investment-intelligence",
              name:
                "return-evaluation-policy",
              version: "1",
            },
            evaluatedAt:
              new Date(
                "2026-07-19T20:00:00.000Z",
              ),
            metadata: {
              scenario:
                "base",
            },
          });

        expect(
          evaluation.id.value,
        ).toBe(
          "evaluation-return",
        );
        expect(
          evaluation.claimId.value,
        ).toBe(
          "claim-return",
        );
        expect(
          evaluation.supportingEvidence(),
        ).toHaveLength(1);
        expect(
          evaluation.metadata,
        ).toEqual({
          policyThreshold:
            0.12,
          scenario:
            "base",
        });
      },
    );

    it(
      "uses the current time when evaluatedAt is omitted",
      () => {
        const before =
          Date.now();

        const evaluation =
          new EvaluationBuilder().build({
            claim:
              createClaim(),
            result: {
              type:
                "investment.return-quality",
              disposition:
                EvaluationDisposition.INSUFFICIENT,
              summary:
                "More Evidence is required.",
              confidence:
                ConfidenceAssessment.create({
                  score:
                    ConfidenceScore.create(
                      30,
                    ),
                  level:
                    ConfidenceLevel.LOW,
                  rationale: [
                    "Limited Evidence.",
                  ],
                }),
              evidenceReferences:
                [],
            },
            source: {
              capability:
                "investment-intelligence",
              name:
                "return-evaluation-policy",
            },
          });

        const after =
          Date.now();

        expect(
          evaluation.evaluatedAt
            .getTime(),
        ).toBeGreaterThanOrEqual(
          before,
        );
        expect(
          evaluation.evaluatedAt
            .getTime(),
        ).toBeLessThanOrEqual(
          after,
        );
      },
    );
  },
);
