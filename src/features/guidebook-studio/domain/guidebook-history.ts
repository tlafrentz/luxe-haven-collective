import {
  createActivityLineageEvent,
  orderActivityLineage,
  type ActivityLineageEvent,
} from "@/platform/activity-lineage";

export type GuidebookVersionRecord = Readonly<{
  id: string;
  version: number;
  status: string;
  snapshot: Readonly<Record<string, unknown>>;
  publishedAt: string;
  publishedBy?: string;
  publicationNotes?: string;
  propertyVersion?: string;
  projectionVersion?: string;
  artifactVersion: string;
  rendererVersion: string;
}>;

export type GuidebookVersionChange = Readonly<{
  category: "section" | "property-variable" | "image" | "metadata";
  key: string;
  label: string;
  state: "added" | "removed" | "updated";
  before?: string;
  after?: string;
}>;

export function normalizeGuidebookVersion(
  row: Record<string, unknown>,
): GuidebookVersionRecord {
  const snapshot = (row.snapshot as Record<string, unknown>) ?? {};
  return deepFreeze({
    id: String(row.id),
    version: Number(row.version),
    status: String(row.status),
    snapshot,
    publishedAt: String(row.published_at ?? row.created_at),
    ...(row.published_by_profile_id
      ? { publishedBy: String(row.published_by_profile_id) }
      : {}),
    ...(row.publication_notes
      ? { publicationNotes: String(row.publication_notes) }
      : {}),
    ...(row.property_version
      ? { propertyVersion: String(row.property_version) }
      : {}),
    ...(row.projection_version
      ? { projectionVersion: String(row.projection_version) }
      : {}),
    artifactVersion: String(
      row.artifact_version ??
        snapshot.schemaVersion ??
        "guidebook-publication-snapshot.v1",
    ),
    rendererVersion: String(
      row.renderer_version ??
        snapshot.rendererVersion ??
        "guidebook-web-renderer.v1",
    ),
  });
}

export function compareGuidebookVersions(
  before: GuidebookVersionRecord,
  after: GuidebookVersionRecord,
) {
  const changes: GuidebookVersionChange[] = [];
  compareMap(
    sectionMap(before.snapshot),
    sectionMap(after.snapshot),
    "section",
    changes,
  );
  compareMap(
    propertyValueMap(before.snapshot),
    propertyValueMap(after.snapshot),
    "property-variable",
    changes,
  );
  compareMap(imageMap(before.snapshot), imageMap(after.snapshot), "image", changes);
  compareMap(
    metadataMap(before.snapshot),
    metadataMap(after.snapshot),
    "metadata",
    changes,
  );
  return deepFreeze({
    before: withoutSnapshot(before),
    after: withoutSnapshot(after),
    changes,
    summary: {
      added: changes.filter((change) => change.state === "added").length,
      removed: changes.filter((change) => change.state === "removed").length,
      updated: changes.filter((change) => change.state === "updated").length,
    },
  });
}

export function buildGuidebookTimeline(input: {
  workspaceId: string;
  guidebookId: string;
  activity: readonly Record<string, unknown>[];
}): readonly ActivityLineageEvent[] {
  return orderActivityLineage(
    input.activity.map((row) =>
      createActivityLineageEvent({
        id: String(row.id),
        workspaceId: input.workspaceId,
        subject: {
          capability: "guidebook-studio",
          type: "guidebook",
          id: input.guidebookId,
        },
        eventType: String(row.event_type),
        summary: String(row.safe_summary),
        occurredAt: String(row.occurred_at),
        ...(row.actor_profile_id
          ? { actorId: String(row.actor_profile_id) }
          : {}),
        metadata: (row.metadata as Record<string, unknown>) ?? {},
      }),
    ),
  );
}

function compareMap(
  before: Map<string, string>,
  after: Map<string, string>,
  category: GuidebookVersionChange["category"],
  output: GuidebookVersionChange[],
) {
  const keys = new Set([...before.keys(), ...after.keys()]);
  for (const key of [...keys].sort()) {
    const left = before.get(key);
    const right = after.get(key);
    if (left === right) continue;
    output.push({
      category,
      key,
      label: humanize(key),
      state: left === undefined ? "added" : right === undefined ? "removed" : "updated",
      ...(left !== undefined ? { before: left } : {}),
      ...(right !== undefined ? { after: right } : {}),
    });
  }
}

function sectionMap(snapshot: Readonly<Record<string, unknown>>) {
  return new Map(
    array(snapshot.sections).map((section) => [
      String(section.section_key ?? section.key ?? section.id),
      stable({
        title: section.title,
        visible: section.visible,
        blocks: section.guidebook_blocks ?? section.blocks ?? [],
      }),
    ]),
  );
}

function propertyValueMap(snapshot: Readonly<Record<string, unknown>>) {
  const projection = object(snapshot.propertyProjection);
  return new Map(
    Object.entries(object(projection.resolvedValues)).map(([key, value]) => [
      key,
      stable(value),
    ]),
  );
}

function imageMap(snapshot: Readonly<Record<string, unknown>>) {
  const result = new Map<string, string>();
  for (const section of array(snapshot.sections)) {
    for (const block of array(section.guidebook_blocks ?? section.blocks)) {
      const content = object(block.content);
      if (block.block_type === "image" || block.type === "image") {
        result.set(String(block.id), stable(content));
      }
      for (const [index, image] of array(content.images).entries()) {
        result.set(`${String(block.id)}:${index}`, stable(image));
      }
    }
  }
  return result;
}

function metadataMap(snapshot: Readonly<Record<string, unknown>>) {
  return new Map(
    ["title", "description", "brand"].map((key) => [key, stable(snapshot[key])]),
  );
}

function withoutSnapshot(version: GuidebookVersionRecord) {
  return {
    id: version.id,
    version: version.version,
    status: version.status,
    publishedAt: version.publishedAt,
    ...(version.publishedBy ? { publishedBy: version.publishedBy } : {}),
    ...(version.publicationNotes
      ? { publicationNotes: version.publicationNotes }
      : {}),
    ...(version.propertyVersion
      ? { propertyVersion: version.propertyVersion }
      : {}),
    ...(version.projectionVersion
      ? { projectionVersion: version.projectionVersion }
      : {}),
    artifactVersion: version.artifactVersion,
    rendererVersion: version.rendererVersion,
  };
}
function array(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
function stable(value: unknown) {
  return JSON.stringify(value ?? null, Object.keys(object(value)).sort());
}
function humanize(value: string) {
  return value.replaceAll("-", " ").replaceAll(/([A-Z])/g, " $1").trim();
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
