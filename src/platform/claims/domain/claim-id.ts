import {
  Identifier,
} from "../../kernel";

export type ClaimId = Identifier;

/**
 * Creates a canonical platform Claim identifier.
 */
export function createClaimId(
  value?: string,
): ClaimId {
  return Identifier.create(
    value ??
      `claim-${crypto.randomUUID()}`,
  );
}
