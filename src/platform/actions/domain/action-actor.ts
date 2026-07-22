export const ACTION_ACTOR_TYPES = ["user", "team", "system", "automation", "unknown"] as const;
export type ActionActorType = (typeof ACTION_ACTOR_TYPES)[number];
export type ActionActor = Readonly<{ type: ActionActorType; id?: string }>;

export function createActionActor(input: ActionActor): ActionActor {
  if (!ACTION_ACTOR_TYPES.includes(input.type)) throw new TypeError("Action actor type is invalid.");
  const id = input.id?.trim();
  if (input.type !== "unknown" && !id) throw new TypeError("Known Action actors require an ID.");
  return Object.freeze({ type: input.type, ...(id ? { id } : {}) });
}
export function sameActionActor(left: ActionActor, right: ActionActor): boolean {
  return left.type === right.type && left.id === right.id;
}
