import {
  type Claim,
} from "../../claims";

import {
  type EvidenceCollection,
} from "../../evidence";

import {
  Evaluation,
  type EvaluationId,
  type EvaluationSourceInput,
} from "../domain";

import {
  evaluateClaim,
} from "./evaluate-claim";

import {
  type EvaluationPolicyRegistry,
} from "./evaluation-policy-registry";

export type EvaluateClaimWithRegistryInput = Readonly<{
  claim: Claim;
  evidence: EvidenceCollection;
  registry:
    EvaluationPolicyRegistry;
  source:
    EvaluationSourceInput;
  evaluatedAt?: Date;
  id?: EvaluationId;
}>;

/**
 * Resolves exactly one supporting policy and evaluates the Claim.
 */
export function evaluateClaimWithRegistry(
  input:
    EvaluateClaimWithRegistryInput,
): Evaluation {
  const policy =
    input.registry.resolve({
      claim:
        input.claim,
      evidence:
        input.evidence,
    });

  return evaluateClaim({
    claim:
      input.claim,
    evidence:
      input.evidence,
    policy,
    source:
      input.source,
    ...(input.evaluatedAt
      ? {
          evaluatedAt:
            input.evaluatedAt,
        }
      : {}),
    ...(input.id
      ? { id: input.id }
      : {}),
  });
}
