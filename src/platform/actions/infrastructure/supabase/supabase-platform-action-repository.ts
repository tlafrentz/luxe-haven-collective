import type { PlatformActionQuery, PlatformActionRepository } from "../../application";
import { PlatformActionCollection, type ActionId, type ActionVersion, type PlatformAction, type WorkspaceId } from "../../domain";
import { mapPersistenceRowsToPlatformAction, mapPlatformActionToPersistenceRows } from "./action-persistence-mapper";
import { PlatformActionPersistenceError, StalePlatformActionVersion } from "./action-persistence-errors";
import type { PlatformActionPersistenceRows } from "./action-persistence-rows";

export type SupabaseRpcError = Readonly<{ code?: string; message: string; details?: string | null; hint?: string | null }>;
export interface PlatformActionRpcClient {
  rpc(name: string, parameters: Readonly<Record<string, unknown>>): PromiseLike<Readonly<{ data: unknown; error: SupabaseRpcError | null }>>;
}

export class SupabasePlatformActionRepository implements PlatformActionRepository {
  public constructor(private readonly client: PlatformActionRpcClient) {}
  public async findById(input: Readonly<{ workspaceId: WorkspaceId; actionId: ActionId }>): Promise<PlatformAction | null> {
    const data = await this.rpc("platform_action_find_by_id", { p_workspace_id: input.workspaceId.value, p_action_id: input.actionId.value });
    return data === null ? null : mapPersistenceRowsToPlatformAction(data as PlatformActionPersistenceRows);
  }
  public async find(input: PlatformActionQuery): Promise<PlatformActionCollection> {
    const query = { ...(input.statuses ? { statuses: input.statuses } : {}), ...(input.owner ? { ownerType: input.owner.type, ...(input.owner.id ? { ownerId: input.owner.id } : {}) } : {}), ...(input.assignee ? { assigneeType: input.assignee.type, ...(input.assignee.id ? { assigneeId: input.assignee.id } : {}) } : {}), ...(input.sourceType ? { sourceType: input.sourceType } : {}), ...(input.sourceId ? { sourceId: input.sourceId } : {}), ...(input.dueBefore ? { dueBefore: input.dueBefore.toISOString() } : {}) };
    const data = await this.rpc("platform_action_find", { p_workspace_id: input.workspaceId.value, p_query: query });
    if (!Array.isArray(data)) throw new PlatformActionPersistenceError("Platform Action query returned an invalid payload.");
    return PlatformActionCollection.create(data.map((value) => mapPersistenceRowsToPlatformAction(value as PlatformActionPersistenceRows)));
  }
  public async add(input: Readonly<{ action: PlatformAction }>): Promise<void> { await this.rpc("platform_action_add", { p_payload: mapPlatformActionToPersistenceRows(input.action) }); }
  public async replace(input: Readonly<{ action: PlatformAction; expectedVersion: ActionVersion }>): Promise<void> {
    try { await this.rpc("platform_action_replace", { p_payload: mapPlatformActionToPersistenceRows(input.action), p_expected_version: input.expectedVersion.value }); }
    catch (error) { if (error instanceof PlatformActionPersistenceError && error.metadata?.databaseCode === "40001") throw new StalePlatformActionVersion(input.action.id.value, input.expectedVersion.value, { cause: error }); throw error; }
  }
  private async rpc(name: string, parameters: Readonly<Record<string, unknown>>): Promise<unknown> {
    const { data, error } = await this.client.rpc(name, parameters);
    if (error) throw new PlatformActionPersistenceError(error.message, { cause: error, metadata: { databaseCode: error.code, function: name } });
    return data;
  }
}
