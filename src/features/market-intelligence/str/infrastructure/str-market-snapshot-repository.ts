import type { SnapshotCompatibilityInput, StrMarketSnapshot, StrMarketSnapshotRepository } from "../domain";
import { freezeStrSnapshot } from "../domain";

export class InMemoryStrMarketSnapshotRepository implements StrMarketSnapshotRepository {
  private readonly snapshots = new Map<string, StrMarketSnapshot>();
  async findCompatible(input: SnapshotCompatibilityInput): Promise<StrMarketSnapshot | null> {
    return [...this.snapshots.values()].filter((snapshot) =>
      snapshot.ownerId === input.ownerId && snapshot.workspaceId === input.workspaceId
      && snapshot.subjectPropertySnapshotId === input.query.subjectPropertySnapshotId
      && snapshot.comparablePolicyVersion === input.comparablePolicyVersion
      && snapshot.providerVersion === input.providerVersion
      && new Date(snapshot.expiresAt) > input.now
      && JSON.stringify(snapshot.query.property) === JSON.stringify(input.query.property)
      && JSON.stringify(snapshot.query.filters ?? {}) === JSON.stringify(input.query.filters ?? {}))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  }
  async findById(id: string, scope: { ownerId: string; workspaceId: string }): Promise<StrMarketSnapshot | null> {
    const value = this.snapshots.get(id);
    return value?.ownerId === scope.ownerId && value.workspaceId === scope.workspaceId ? value : null;
  }
  async save(snapshot: StrMarketSnapshot): Promise<void> {
    if (this.snapshots.has(snapshot.id)) throw new Error("Market snapshots are immutable and cannot be overwritten.");
    this.snapshots.set(snapshot.id, freezeStrSnapshot(structuredClone(snapshot)));
  }
}

interface SupabaseLike {
  from(table: string): {
    select(columns: string): SupabaseSelectQuery;
    insert(value: unknown): PromiseLike<{ error: { message: string } | null }>;
  };
}
interface SupabaseSelectQuery extends PromiseLike<{ data: { payload: unknown } | null; error: { message: string } | null }> {
  eq(column: string, value: unknown): SupabaseSelectQuery;
  gt(column: string, value: unknown): SupabaseSelectQuery;
  order(column: string, options: { ascending: boolean }): SupabaseSelectQuery;
  limit(count: number): SupabaseSelectQuery;
  maybeSingle(): PromiseLike<{ data: { payload: unknown } | null; error: { message: string } | null }>;
}

export class SupabaseStrMarketSnapshotRepository implements StrMarketSnapshotRepository {
  private readonly client: SupabaseLike;
  constructor(client: unknown) { this.client = client as SupabaseLike; }
  async findCompatible(input: SnapshotCompatibilityInput): Promise<StrMarketSnapshot | null> {
    const result = await this.client.from("str_market_snapshots").select("payload").eq("owner_id", input.ownerId).eq("workspace_id", input.workspaceId)
      .eq("subject_property_snapshot_id", input.query.subjectPropertySnapshotId).eq("comparable_policy_version", input.comparablePolicyVersion)
      .eq("provider_version", input.providerVersion).gt("expires_at", input.now.toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (result.error) throw new Error(`STR market snapshot lookup failed: ${result.error.message}`);
    if (!result.data) return null;
    const snapshot = hydrate(result.data.payload);
    return JSON.stringify(snapshot.query.property) === JSON.stringify(input.query.property)
      && JSON.stringify(snapshot.query.filters ?? {}) === JSON.stringify(input.query.filters ?? {}) ? snapshot : null;
  }
  async findById(id: string, scope: { ownerId: string; workspaceId: string }): Promise<StrMarketSnapshot | null> {
    const result = await this.client.from("str_market_snapshots").select("payload").eq("id", id).eq("owner_id", scope.ownerId).eq("workspace_id", scope.workspaceId).maybeSingle();
    if (result.error) throw new Error(`STR market snapshot lookup failed: ${result.error.message}`);
    return result.data ? hydrate(result.data.payload) : null;
  }
  async save(snapshot: StrMarketSnapshot): Promise<void> {
    const result = await this.client.from("str_market_snapshots").insert({
      id: snapshot.id, owner_id: snapshot.ownerId, workspace_id: snapshot.workspaceId, subject_property_id: snapshot.subjectPropertyId,
      subject_property_snapshot_id: snapshot.subjectPropertySnapshotId, provider: snapshot.provider, provider_version: snapshot.providerVersion,
      query_policy_version: snapshot.queryPolicyVersion, comparable_policy_version: snapshot.comparablePolicyVersion,
      confidence_score: snapshot.confidence.score, completeness: snapshot.completeness, warnings: snapshot.warnings,
      payload: snapshot, created_at: snapshot.createdAt, expires_at: snapshot.expiresAt,
    });
    if (result.error) throw new Error(`STR market snapshot persistence failed: ${result.error.message}`);
  }
}

function hydrate(value: unknown): StrMarketSnapshot {
  if (!value || typeof value !== "object") throw new Error("Persisted STR market snapshot payload is invalid.");
  return freezeStrSnapshot(value as StrMarketSnapshot);
}
