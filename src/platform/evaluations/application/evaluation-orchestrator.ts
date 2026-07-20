import {
  type ClaimCollection,
} from "../../claims";

import {
  type EvidenceCollection,
} from "../../evidence";

import {
  EvaluationCollection,
  type EvaluationId,
} from "../domain";

import {
  evaluateClaim,
} from "./evaluate-claim";

import {
  type EvaluationPolicy,
} from "./evaluation-policy";

import {
  EvaluationPolicyRegistry,
} from "./evaluation-policy-registry";

import {
  EvaluationDiagnostics,
  EvaluationSession,
} from "./evaluation-session";

export type EvaluationOrchestratorInput = Readonly<{
  claims: ClaimCollection;
  evidence: EvidenceCollection;
  sourceCapability: string;
  registry?: EvaluationPolicyRegistry;
  now?: () => Date;
  createEvaluationId?: (
    claimId: string,
    policy: EvaluationPolicy,
  ) => EvaluationId;
}>;

/**
 * Canonical batch execution coordinator for Claim evaluation.
 *
 * A Claim with no supporting policy is skipped. Ambiguous policy resolution or
 * a policy/build failure is recorded as a failure. Both are recoverable at the
 * batch boundary, so the remaining Claims are always processed.
 */
export class EvaluationOrchestrator {
  public constructor(
    private readonly registry?: EvaluationPolicyRegistry,
  ) {}

  public execute(
    input: EvaluationOrchestratorInput,
  ): EvaluationSession {
    const registry = input.registry ?? this.registry;

    if (!registry) {
      throw new TypeError("An Evaluation policy registry is required.");
    }

    const sourceCapability = requireText(
      input.sourceCapability,
      "Evaluation source capability",
    );
    const now = input.now ?? (() => new Date());
    const startedAt = copyNow(now(), "Evaluation execution start date");
    const evaluations = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    const skippedClaims: string[] = [];
    const failedClaims: string[] = [];

    for (const claim of input.claims.toArray()) {
      const context = { claim, evidence: input.evidence };
      const supported = registry.supporting(context);

      if (supported.length === 0) {
        skippedClaims.push(claim.id.value);
        warnings.push(
          `No Evaluation policy supports Claim "${claim.id.value}".`,
        );
        continue;
      }

      if (supported.length > 1) {
        failedClaims.push(claim.id.value);
        errors.push(
          `Multiple Evaluation policies support Claim "${claim.id.value}": ${supported
            .map((policy) => policy.name)
            .join(", ")}.`,
        );
        continue;
      }

      const policy = supported[0];

      try {
        evaluations.push(
          evaluateClaim({
            claim,
            evidence: input.evidence,
            policy,
            source: {
              capability: sourceCapability,
              name: policy.name,
              ...(policy.version ? { version: policy.version } : {}),
            },
            evaluatedAt: copyNow(now(), "Evaluation date"),
            ...(input.createEvaluationId
              ? { id: input.createEvaluationId(claim.id.value, policy) }
              : {}),
          }),
        );
      } catch (error) {
        failedClaims.push(claim.id.value);
        errors.push(
          `Evaluation failed for Claim "${claim.id.value}" using policy "${policy.name}": ${errorMessage(error)}`,
        );
      }
    }

    const completedAt = copyNow(now(), "Evaluation execution completion date");
    const evaluationCollection = EvaluationCollection.create(evaluations);

    return EvaluationSession.create({
      startedAt,
      completedAt,
      claimsProcessed: input.claims.size,
      evaluationsCreated: evaluationCollection.size,
      claimsSkipped: skippedClaims.length,
      claimsFailed: failedClaims.length,
      evaluationCollection,
      diagnostics: EvaluationDiagnostics.create({
        warnings,
        errors,
        skippedClaims,
        failedClaims,
      }),
    });
  }
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new TypeError(`${field} cannot be empty.`);
  }

  return normalized;
}

function copyNow(value: Date, field: string): Date {
  const copy = new Date(value.getTime());

  if (Number.isNaN(copy.getTime())) {
    throw new TypeError(`${field} must be valid.`);
  }

  return copy;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
