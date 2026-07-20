import {
  Identifier,
} from "../../kernel";

export type EvaluationId = Identifier;

/**
 * Creates a canonical platform Evaluation identifier.
 */
export function createEvaluationId(
  value?: string,
): EvaluationId {
  return Identifier.create(
    value ??
      `evaluation-${crypto.randomUUID()}`,
  );
}
