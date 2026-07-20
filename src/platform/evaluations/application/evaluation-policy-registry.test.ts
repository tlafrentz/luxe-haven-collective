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
  type EvaluationPolicy,
} from "./evaluation-policy";

import {
  EvaluationPolicyRegistry,
} from "./evaluation-policy-registry";

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
  name: string,
  supports:
    boolean,
): EvaluationPolicy {
  return {
    name,
    supports: () =>
      supports,
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
              80,
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

const context = {
  claim:
    createClaim(),
  evidence:
    EvidenceCollection.empty(),
};

describe(
  "EvaluationPolicyRegistry",
  () => {
    it(
      "registers policies immutably",
      () => {
        const empty =
          EvaluationPolicyRegistry.empty();

        const policy =
          createPolicy(
            "return-policy",
            true,
          );

        const registered =
          empty.register(
            policy,
          );

        expect(
          empty.size,
        ).toBe(0);
        expect(
          registered.size,
        ).toBe(1);
        expect(
          registered.toArray(),
        ).toEqual([
          policy,
        ]);
      },
    );

    it(
      "resolves the only supporting policy",
      () => {
        const supported =
          createPolicy(
            "supported-policy",
            true,
          );

        const unsupported =
          createPolicy(
            "unsupported-policy",
            false,
          );

        const registry =
          EvaluationPolicyRegistry.create([
            unsupported,
            supported,
          ]);

        expect(
          registry.resolve(
            context,
          ),
        ).toBe(
          supported,
        );
      },
    );

    it(
      "rejects duplicate policy names",
      () => {
        expect(() =>
          EvaluationPolicyRegistry.create([
            createPolicy(
              "return-policy",
              true,
            ),
            createPolicy(
              "return-policy",
              false,
            ),
          ]),
        ).toThrow(
          "Evaluation policy names must be unique.",
        );
      },
    );

    it(
      "rejects missing supporting policies",
      () => {
        const registry =
          EvaluationPolicyRegistry.create([
            createPolicy(
              "unsupported-policy",
              false,
            ),
          ]);

        expect(() =>
          registry.resolve(
            context,
          ),
        ).toThrow(
          'No Evaluation policy supports Claim "claim-return".',
        );
      },
    );

    it(
      "rejects ambiguous supporting policies",
      () => {
        const registry =
          EvaluationPolicyRegistry.create([
            createPolicy(
              "policy-a",
              true,
            ),
            createPolicy(
              "policy-b",
              true,
            ),
          ]);

        expect(() =>
          registry.resolve(
            context,
          ),
        ).toThrow(
          'Multiple Evaluation policies support Claim "claim-return": policy-a, policy-b.',
        );
      },
    );

    it(
      "returns defensive arrays",
      () => {
        const registry =
          EvaluationPolicyRegistry.create([
            createPolicy(
              "return-policy",
              true,
            ),
          ]);

        const policies = [
          ...registry.toArray(),
        ];

        policies.length = 0;

        expect(
          registry.size,
        ).toBe(1);
      },
    );
  },
);
