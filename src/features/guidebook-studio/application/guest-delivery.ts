import { normalizePublicSlug, parseGuidebookListQuery, type GuidebookListQuery } from "../domain";

export type ImmutableGuidebookEnvelope = Readonly<{
  artifactType: "guidebook";
  artifactVersion: string;
  rendererVersion: string;
  publishedAt: string;
  version: number;
  payload: Readonly<Record<string, unknown>>;
}>;
export type GuestGuidebookDelivery =
  | Readonly<{ state: "active"; envelope: ImmutableGuidebookEnvelope }>
  | Readonly<{ state: "redirect"; slug: string }>
  | Readonly<{ state: "unavailable" }>;

export interface GuidebookDeliveryRepository {
  resolveActive(slug: string): Promise<Readonly<{ status: string; publicUrlStatus: string; activeVersionId: string | null; version: Readonly<{ id: string; version: number; snapshot: unknown; publishedAt: string }> | null }> | null>;
  resolveRedirect(slug: string, now: string): Promise<string | null>;
  loadHistoricalVersion(input: Readonly<{ actorId: string; workspaceId: string; guidebookId: string; versionId: string }>): Promise<Readonly<{ version: number; snapshot: unknown; publishedAt: string }> | null>;
}

export interface GuidebookLibraryRepository<T> {
  list(workspaceId: string, query: GuidebookListQuery): Promise<Readonly<{ items: readonly T[]; total: number }>>;
}

export async function resolvePublicGuidebook(repository: GuidebookDeliveryRepository, rawSlug: string, now = new Date().toISOString()): Promise<GuestGuidebookDelivery> {
  const slug = normalizePublicSlug(rawSlug);
  if (!slug) return Object.freeze({ state: "unavailable" });
  const found = await repository.resolveActive(slug);
  if (!found) {
    const replacement = await repository.resolveRedirect(slug, now);
    return replacement ? Object.freeze({ state: "redirect", slug: replacement }) : Object.freeze({ state: "unavailable" });
  }
  if (found.status !== "published" || found.publicUrlStatus !== "active" || !found.activeVersionId || !found.version || found.version.id !== found.activeVersionId) return Object.freeze({ state: "unavailable" });
  const payload = parseSnapshot(found.version.snapshot);
  if (!payload) return Object.freeze({ state: "unavailable" });
  return Object.freeze({ state: "active", envelope: envelope(payload, found.version) });
}

export async function loadHistoricalGuidebookPreview(repository: GuidebookDeliveryRepository, input: Readonly<{ actorId: string; workspaceId: string; guidebookId: string; versionId: string }>) {
  const version = await repository.loadHistoricalVersion(input);
  if (!version) return null;
  const payload = parseSnapshot(version.snapshot);
  return payload ? Object.freeze({ envelope: envelope(payload, version), historical: true as const }) : null;
}

export async function listGuidebookLibrary<T>(repository: GuidebookLibraryRepository<T>, workspaceId: string, input: Readonly<Record<string, string | undefined>>) {
  const query = parseGuidebookListQuery(input);
  const result = await repository.list(workspaceId, query);
  return Object.freeze({ ...result, query, hasPrevious: query.page > 1, hasNext: query.page * query.pageSize < result.total });
}

function parseSnapshot(value: unknown): Readonly<Record<string, unknown>> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Record<string, unknown>;
  if (snapshot.schemaVersion !== "guidebook-publication-snapshot.v1" || !Array.isArray(snapshot.sections)) return null;
  return Object.freeze({ ...snapshot });
}
function envelope(payload: Readonly<Record<string, unknown>>, version: Readonly<{ version: number; publishedAt: string }>): ImmutableGuidebookEnvelope {
  return Object.freeze({ artifactType: "guidebook", artifactVersion: "guidebook-publication-snapshot.v1", rendererVersion: String(payload.rendererVersion ?? "guidebook-web-renderer.v1"), publishedAt: version.publishedAt, version: version.version, payload });
}
