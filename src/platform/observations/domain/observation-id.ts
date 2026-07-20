import { Identifier } from "../../kernel";

const OBSERVATION_ID_PREFIX = "observation-";

/**
 * Strongly named identifier boundary for platform observations.
 */
export type ObservationId = Identifier<string>;

export function createObservationId(
  value?: string,
): ObservationId {
  if (value !== undefined) {
    return Identifier.create(value);
  }

  return Identifier.create(
    `${OBSERVATION_ID_PREFIX}${crypto.randomUUID()}`,
  );
}
