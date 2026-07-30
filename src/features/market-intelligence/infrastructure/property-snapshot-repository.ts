import {
  freezeSubjectProperty,
  type PropertySnapshot,
  type PropertySnapshotRepository,
  type PropertySnapshotScope,
  type SourcedPropertyField,
  type SubjectProperty,
} from "../domain/subject-property";

export class InMemoryPropertySnapshotRepository implements PropertySnapshotRepository {
  private readonly snapshots: PropertySnapshot[] = [];

  async findById(id: string, scope: PropertySnapshotScope): Promise<PropertySnapshot | null> {
    return this.snapshots.find((item) => item.id === id && inScope(item, scope)) ?? null;
  }

  async findFreshByAddress(key: string, now: Date, scope: PropertySnapshotScope): Promise<PropertySnapshot | null> {
    const snapshot = this.latest(key, scope, (item) => item.expiresAt.getTime() > now.getTime());
    return snapshot ?? null;
  }

  async findLatestByAddress(key: string, scope: PropertySnapshotScope): Promise<PropertySnapshot | null> {
    return this.latest(key, scope) ?? null;
  }

  async nextVersion(subjectPropertyId: string, scope: PropertySnapshotScope): Promise<number> {
    return Math.max(0, ...this.snapshots.filter((item) => item.subjectPropertyId === subjectPropertyId && inScope(item, scope)).map((item) => item.version)) + 1;
  }

  async save(snapshot: PropertySnapshot): Promise<void> {
    if (this.snapshots.some((item) => item.id === snapshot.id)) return;
    this.snapshots.push(snapshot);
  }

  private latest(key: string, scope: PropertySnapshotScope, predicate: (item: PropertySnapshot) => boolean = () => true): PropertySnapshot | undefined {
    return this.snapshots.filter((item) => item.normalizedAddressKey === key && inScope(item, scope) && predicate(item))
      .sort((a, b) => b.version - a.version)[0];
  }
}

interface SnapshotQuery {
  select(columns: string): SnapshotQuery;
  eq(column: string, value: unknown): SnapshotQuery;
  gt(column: string, value: unknown): SnapshotQuery;
  order(column: string, options: { ascending: boolean }): SnapshotQuery;
  limit(count: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
  insert(value: unknown): PromiseLike<{ error: { message: string } | null }>;
}

export interface PropertySnapshotDatabase {
  from(table: "property_snapshots"): SnapshotQuery;
}

export class SupabasePropertySnapshotRepository implements PropertySnapshotRepository {
  constructor(private readonly database: PropertySnapshotDatabase) {}

  async findById(id: string, scope: PropertySnapshotScope): Promise<PropertySnapshot | null> {
    const query = this.database.from("property_snapshots").select("*").eq("id", id)
      .eq("owner_id", scope.ownerId).eq("workspace_id", scope.workspaceId)
      .order("version", { ascending: false });
    return this.one(await query.limit(1));
  }

  async findFreshByAddress(key: string, now: Date, scope: PropertySnapshotScope): Promise<PropertySnapshot | null> {
    const query = this.database.from("property_snapshots").select("*")
      .eq("owner_id", scope.ownerId).eq("workspace_id", scope.workspaceId)
      .eq("normalized_address_key", key).gt("expires_at", now.toISOString())
      .order("version", { ascending: false });
    return this.one(await query.limit(1));
  }

  async findLatestByAddress(key: string, scope: PropertySnapshotScope): Promise<PropertySnapshot | null> {
    const query = this.database.from("property_snapshots").select("*")
      .eq("owner_id", scope.ownerId).eq("workspace_id", scope.workspaceId)
      .eq("normalized_address_key", key).order("version", { ascending: false });
    return this.one(await query.limit(1));
  }

  async nextVersion(subjectPropertyId: string, scope: PropertySnapshotScope): Promise<number> {
    const query = this.database.from("property_snapshots").select("version")
      .eq("owner_id", scope.ownerId).eq("workspace_id", scope.workspaceId)
      .eq("subject_property_id", subjectPropertyId).order("version", { ascending: false });
    const result = await query.limit(1);
    if (result.error) throw new Error(`Property snapshot lookup failed: ${result.error.message}`);
    const version = (result.data?.[0] as { version?: unknown } | undefined)?.version;
    return (typeof version === "number" ? version : 0) + 1;
  }

  async save(snapshot: PropertySnapshot): Promise<void> {
    const { error } = await this.database.from("property_snapshots").insert({
      id: snapshot.id,
      owner_id: snapshot.ownerId,
      workspace_id: snapshot.workspaceId,
      subject_property_id: snapshot.subjectPropertyId,
      provider: snapshot.property.provider,
      provider_property_id: snapshot.property.providerPropertyId,
      normalized_address_key: snapshot.normalizedAddressKey,
      version: snapshot.version,
      schema_version: snapshot.property.schemaVersion,
      provider_version: snapshot.property.providerVersion,
      source_endpoint: snapshot.property.sourceEndpoint,
      payload: serializeSnapshot(snapshot),
      captured_at: snapshot.capturedAt.toISOString(),
      listing_fresh_until: snapshot.listingFreshUntil.toISOString(),
      expires_at: snapshot.expiresAt.toISOString(),
    });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      throw new Error(`Property snapshot persistence failed: ${error.message}`);
    }
  }

  private one(result: { data: unknown[] | null; error: { message: string } | null }): PropertySnapshot | null {
    if (result.error) throw new Error(`Property snapshot lookup failed: ${result.error.message}`);
    const row = result.data?.[0] as { payload?: unknown } | undefined;
    return row?.payload ? hydrateSnapshot(row.payload) : null;
  }
}

function inScope(snapshot: PropertySnapshot, scope: PropertySnapshotScope): boolean {
  return snapshot.ownerId === scope.ownerId && snapshot.workspaceId === scope.workspaceId;
}

function serializeSnapshot(snapshot: PropertySnapshot): unknown {
  return JSON.parse(JSON.stringify(snapshot));
}

function hydrateSnapshot(value: unknown): PropertySnapshot {
  if (!value || typeof value !== "object") throw new Error("Persisted property snapshot payload is invalid.");
  const snapshot = value as PropertySnapshot;
  const retrievedAt = new Date(snapshot.property.retrievedAt);
  const hydrateField = <T>(field: SourcedPropertyField<T>): SourcedPropertyField<T> => ({
    value: field.value,
    lineage: { ...field.lineage, retrievedAt: new Date(field.lineage.retrievedAt) },
  });
  const property: SubjectProperty = {
    ...snapshot.property,
    retrievedAt,
    address: mapFields(snapshot.property.address, hydrateField),
    physical: mapFields(snapshot.property.physical, hydrateField),
    listing: mapFields(snapshot.property.listing, hydrateField),
  };
  return freezeSubjectProperty({
    ...snapshot,
    property,
    capturedAt: new Date(snapshot.capturedAt),
    listingFreshUntil: new Date(snapshot.listingFreshUntil),
    expiresAt: new Date(snapshot.expiresAt),
  });
}

function mapFields<T extends object>(
  fields: T,
  hydrate: <V>(field: SourcedPropertyField<V>) => SourcedPropertyField<V>,
): T {
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, hydrate(field as SourcedPropertyField<unknown>)])) as T;
}
