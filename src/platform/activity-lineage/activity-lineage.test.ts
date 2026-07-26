import { describe, expect, it } from "vitest";
import { createActivityLineageEvent, orderActivityLineage } from ".";

describe("Platform Activity & Lineage", () => {
  it("creates immutable cross-capability lineage events", () => {
    const event = createActivityLineageEvent({
      id: "event-1",
      workspaceId: "workspace-1",
      subject: { capability: "guidebook-studio", type: "guidebook", id: "guide-1" },
      source: { capability: "property", type: "projection", id: "property-1", version: "23" },
      result: { capability: "guidebook-studio", type: "artifact", id: "version-7", version: "7" },
      eventType: "published",
      summary: "Version 7 published.",
      occurredAt: "2026-07-26T12:00:00Z",
      metadata: {},
    });

    expect(Object.isFrozen(event)).toBe(true);
    expect(event.source?.version).toBe("23");
  });

  it("orders simultaneous events deterministically", () => {
    const base = {
      workspaceId: "workspace-1",
      subject: { capability: "reports", type: "report", id: "report-1" },
      eventType: "published",
      summary: "Published.",
      occurredAt: "2026-07-26T12:00:00Z",
      metadata: {},
    };
    const events = [
      createActivityLineageEvent({ ...base, id: "a" }),
      createActivityLineageEvent({ ...base, id: "b" }),
    ];
    expect(orderActivityLineage(events).map((event) => event.id)).toEqual(["b", "a"]);
  });
});
