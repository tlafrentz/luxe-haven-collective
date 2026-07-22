import { createActionActor, type ActionActor, type ActionActorType } from "./action-actor";
export type ActionOwnerType = ActionActorType;
export type ActionOwner = Readonly<{ type: ActionOwnerType; id?: string }>;
export function createActionOwner(input: ActionOwner): ActionOwner { return createActionActor(input) as ActionOwner; }
export function ownerAsActor(owner: ActionOwner): ActionActor { return owner; }
