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
  EvaluationBuilder,
} from "./evaluation-builder";

import {
  type EvaluationPolicy,
} from "./evaluation-policy";

export type EvaluateClaimInput = Readonly<{
  claim: Claim;
  evidence: EvidenceCollection;
  policy: EvaluationPolicy;
  source:
    EvaluationSourceInput;
  evaluatedAt?: Date;
  id?: EvaluationId;
}>;

/**
 * Orchestrates one Claim evaluation using one explicit policy.
 */
export function evaluateClaim(
  input: EvaluateClaimInput,
): Evaluation {
  const context = {
    claim:
      input.claim,
    evidence:
      input.evidence,
  };

  if (
    !input.policy.supports(
      context,
    )
  ) {
    throw new RangeError(
      `Evaluation policy "${input.policy.name}" does not support Claim "${input.claim.id.value}".`,
    );
  }

  const result =
    input.policy.evaluate(
      context,
    );

  return new EvaluationBuilder().build({
    claim:
      input.claim,
    result,
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
