import { Identifier } from "../../kernel";

const EVIDENCE_ID_PREFIX = "evidence-";

/**
 * Strongly named identifier boundary for platform evidence.
 */
export type EvidenceId = Identifier<string>;

export function createEvidenceId(
  value?: string,
): EvidenceId {
  if (value !== undefined) {
    return Identifier.create(value);
  }

  return Identifier.create(
    `${EVIDENCE_ID_PREFIX}${crypto.randomUUID()}`,
  );
}
