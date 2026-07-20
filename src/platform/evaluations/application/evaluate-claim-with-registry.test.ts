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
} from "../domain";

import {
  evaluateClaimWithRegistry,
} from "./evaluate-claim-with-registry";

import {
  type EvaluationPolicy,
} from "./evaluation-policy";

import {
  EvaluationPolicyRegistry,
} from "./evaluation-policy-registry";

function createPolicy():
  EvaluationPolicy {
  return {
    name:
      "return-evaluation-policy",
    supports: ({
      claim,
    }) =>
      claim.type ===
      "investment.return",
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
              86,
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
  "evaluateClaimWithRegistry",
  () => {
    it(
      "resolves and applies a policy",
      () => {
        const claim =
          Claim.create({
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

        const evaluation =
          evaluateClaimWithRegistry({
            claim,
            evidence:
              EvidenceCollection.empty(),
            registry:
              EvaluationPolicyRegistry.create([
                createPolicy(),
              ]),
            source: {
              capability:
                "investment-intelligence",
              name:
                "return-evaluation-policy",
            },
            evaluatedAt:
              new Date(
                "2026-07-19T20:00:00.000Z",
              ),
          });

        expect(
          evaluation.claimId
            .equals(
              claim.id,
            ),
        ).toBe(true);
        expect(
          evaluation.isSupported(),
        ).toBe(true);
      },
    );
  },
);
