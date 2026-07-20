import {
  type Claim,
} from "../../claims";

import {
  type ObservationValue,
} from "../../observations";

import {
  Evaluation,
  EvaluationSource,
  type EvaluationId,
} from "../domain";

import {
  type EvaluationPolicyResult,
} from "./evaluation-policy";

export type EvaluationBuilderInput = Readonly<{
  claim: Claim;
  result: EvaluationPolicyResult;
  source:
    | EvaluationSource
    | Readonly<{
        capability: string;
        name: string;
        version?: string;
      }>;
  evaluatedAt?: Date;
  id?: EvaluationId;
  metadata?: Readonly<
    Record<string, ObservationValue>
  >;
}>;

/**
 * Application service that assembles a canonical Evaluation from a completed
 * policy result.
 *
 * The builder does not decide disposition, confidence, Evidence influence, or
 * summary content. Those remain policy responsibilities.
 */
export class EvaluationBuilder {
  public build(
    input: EvaluationBuilderInput,
  ): Evaluation {
    const evaluatedAt =
      input.evaluatedAt ??
      new Date();

    const resultMetadata =
      normalizeMetadata(
        input.result.metadata,
      );

    return Evaluation.create({
      ...(input.id
        ? { id: input.id }
        : {}),
      type:
        input.result.type,
      claimId:
        input.claim.id,
      disposition:
        input.result.disposition,
      summary:
        input.result.summary,
      confidence:
        input.result.confidence,
      evidenceReferences:
        input.result
          .evidenceReferences,
      source:
        input.source,
      evaluatedAt,
      metadata: {
        ...resultMetadata,
        ...input.metadata,
      },
    });
  }
}

function normalizeMetadata(
  metadata:
    | Readonly<
        Record<string, unknown>
      >
    | undefined,
): Readonly<
  Record<string, ObservationValue>
> {
  if (!metadata) {
    return {};
  }

  const entries =
    Object.entries(metadata).filter(
      (
        entry,
      ): entry is [
        string,
        ObservationValue,
      ] =>
        isObservationValue(
          entry[1],
        ),
    );

  return Object.fromEntries(
    entries,
  );
}

function isObservationValue(
  value: unknown,
): value is ObservationValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(
      isObservationValue,
    );
  }

  if (
    typeof value === "object"
  ) {
    return Object.values(
      value as Record<
        string,
        unknown
      >,
    ).every(
      isObservationValue,
    );
  }

  return false;
}
