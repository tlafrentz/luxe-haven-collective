import type { Identifier } from "../../kernel";
import { createActionActor, type ActionActor } from "./action-actor";
/** Structurally compatible reference to the downstream canonical Outcome ID. */
export type ActionOutcomeId = Identifier;
export const ACTION_OUTCOME_LINK_TYPES = ["result", "impact", "related"] as const;
export type ActionOutcomeLinkType = (typeof ACTION_OUTCOME_LINK_TYPES)[number];
export type PlatformActionOutcomeReference = Readonly<{ outcomeId: ActionOutcomeId; linkType: ActionOutcomeLinkType; linkedAt: Date; linkedBy: ActionActor }>;
export function createActionOutcomeReference(input: PlatformActionOutcomeReference): PlatformActionOutcomeReference {
  if (!ACTION_OUTCOME_LINK_TYPES.includes(input.linkType)) throw new TypeError("Action Outcome link type is invalid.");
  const linkedAt = new Date(input.linkedAt); if (Number.isNaN(linkedAt.getTime())) throw new TypeError("Action Outcome link date must be valid.");
  return Object.freeze({ ...input, linkedAt, linkedBy: createActionActor(input.linkedBy) });
}
