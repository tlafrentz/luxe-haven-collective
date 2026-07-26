import { describe, expect, it } from "vitest";
import {
  buildGuidebookTimeline,
  compareGuidebookVersions,
  normalizeGuidebookVersion,
} from "./domain/guidebook-history";

function version(
  id: string,
  number: number,
  snapshot: Record<string, unknown>,
) {
  return normalizeGuidebookVersion({
    id,
    version: number,
    status: number === 2 ? "published" : "superseded",
    snapshot,
    published_at: `2026-07-0${number}T12:00:00Z`,
    property_version: `property-${number}`,
    projection_version: "property-projection.v1",
  });
}

describe("guidebook version history", () => {
  it("compares content, property values, images, and metadata without raw JSON output", () => {
    const before = version("version-1", 1, {
      title: "Guest Guide",
      description: "Original",
      propertyProjection: { resolvedValues: { wifi: "Old password" } },
      sections: [
        {
          id: "arrival",
          section_key: "arrival",
          title: "Arrival",
          blocks: [{ id: "hero", type: "image", content: { url: "old.jpg" } }],
        },
      ],
    });
    const after = version("version-2", 2, {
      title: "Guest Guide",
      description: "Updated",
      propertyProjection: { resolvedValues: { wifi: "New password" } },
      sections: [
        {
          id: "arrival",
          section_key: "arrival",
          title: "Arrival instructions",
          blocks: [{ id: "hero", type: "image", content: { url: "new.jpg" } }],
        },
        { id: "ev", section_key: "ev-charging", title: "EV charging", blocks: [] },
      ],
    });

    const comparison = compareGuidebookVersions(before, after);

    expect(comparison.summary).toEqual({ added: 1, removed: 0, updated: 4 });
    expect(comparison.changes.map((change) => change.category)).toEqual(
      expect.arrayContaining(["section", "property-variable", "image", "metadata"]),
    );
    expect(comparison.before).not.toHaveProperty("snapshot");
  });

  it("normalizes renderer provenance and orders append-only activity", () => {
    const normalized = version("version-1", 1, { schemaVersion: "artifact.v1" });
    const timeline = buildGuidebookTimeline({
      workspaceId: "workspace-1",
      guidebookId: "guidebook-1",
      activity: [
        { id: "first", event_type: "created", safe_summary: "Created", occurred_at: "2026-07-01T00:00:00Z" },
        { id: "second", event_type: "published", safe_summary: "Published", occurred_at: "2026-07-02T00:00:00Z" },
      ],
    });

    expect(normalized.artifactVersion).toBe("artifact.v1");
    expect(timeline.map((event) => event.id)).toEqual(["second", "first"]);
    expect(Object.isFrozen(timeline[0])).toBe(true);
  });
});
