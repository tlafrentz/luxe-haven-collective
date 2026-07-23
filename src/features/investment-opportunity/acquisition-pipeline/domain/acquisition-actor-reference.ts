import { AcquisitionDomainError } from "./errors";

export const ACQUISITION_ACTOR_TYPES = ["user", "system"] as const;
export type AcquisitionActorType = (typeof ACQUISITION_ACTOR_TYPES)[number];
export type AcquisitionActorReference = Readonly<{ type: AcquisitionActorType; id: string }>;
export function createAcquisitionActorReference(input: AcquisitionActorReference): AcquisitionActorReference {
  if (!ACQUISITION_ACTOR_TYPES.includes(input.type) || !input.id.trim()) throw new AcquisitionDomainError("INVALID_ACQUISITION_ACTOR");
  return Object.freeze({ type: input.type, id: input.id.trim() });
}
