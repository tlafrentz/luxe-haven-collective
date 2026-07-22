import type { ActionAssignmentId, ActionId } from "../domain";
import type { PlatformActionRepository } from "./action-repository";

export type PlatformActionProviderDependencies = Readonly<{
  repository: PlatformActionRepository;
  createActionId: () => ActionId;
  createAssignmentId: () => ActionAssignmentId;
  now: () => Date;
}>;
