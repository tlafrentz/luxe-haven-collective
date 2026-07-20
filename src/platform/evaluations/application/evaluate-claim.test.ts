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
  EvidenceCollection,
} from "../../evidence";

import {
  ConfidenceAssessment,
  ConfidenceLevel,
  ConfidenceScore,
} from "../../scoring";

import {
  EvaluationDisposition,
  createEvaluationId,
} from "../domain";

import {
  evaluateClaim,
} from "./evaluate-claim";

import {
  type EvaluationPolicy,
} from "./evaluation-policy";

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

function createPolicy(
  supported = true,
): EvaluationPolicy {
  return {
    name:
      "return-evaluation-policy",
    version:
      "1",
    supports: () =>
      supported,
    evaluate: () => ({
      type:
        "investment.return-quality",
      disposition:
        EvaluationDisposition.SUPPORTED,
      summary:
        "Evidence supports the Claim.",
      confidence:
        ConfidenceAssessment.create({
          score:
            ConfidenceScore.create(
              88,
            ),
          level:
            ConfidenceLevel.HIGH,
          rationale: [
            "Sufficient Evidence.",
          ],
        }),
      evidenceReferences:
        [],
    }),
  };
}

describe(
  "evaluateClaim",
  () => {
    it(
      "evaluates a supported Claim",
      () => {
        const evaluation =
          evaluateClaim({
            id:
              createEvaluationId(
                "evaluation-return",
              ),
            claim:
              createClaim(),
            evidence:
              EvidenceCollection.empty(),
            policy:
              createPolicy(),
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
          });

        expect(
          evaluation.id.value,
        ).toBe(
          "evaluation-return",
        );
        expect(
          evaluation.isSupported(),
        ).toBe(true);
      },
    );

    it(
      "rejects unsupported Claims",
      () => {
        expect(() =>
          evaluateClaim({
            claim:
              createClaim(),
            evidence:
              EvidenceCollection.empty(),
            policy:
              createPolicy(false),
            source: {
              capability:
                "investment-intelligence",
              name:
                "return-evaluation-policy",
            },
          }),
        ).toThrow(
          'Evaluation policy "return-evaluation-policy" does not support Claim "claim-return".',
        );
      },
    );
  },
);
