import type { ActionId, ActionVersion, PlatformAction, PlatformActionCollection, WorkspaceId } from "../domain";
import type { PlatformActionQuery } from "./action-queries";
export interface PlatformActionRepository {
  findById(input: Readonly<{ workspaceId: WorkspaceId; actionId: ActionId }>): Promise<PlatformAction | null>;
  find(input: PlatformActionQuery): Promise<PlatformActionCollection>;
  add(input: Readonly<{ action: PlatformAction }>): Promise<void>;
  replace(input: Readonly<{ action: PlatformAction; expectedVersion: ActionVersion }>): Promise<void>;
}
