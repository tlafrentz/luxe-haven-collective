import { describe, expect, it } from "vitest";
import type { ExecutiveAction } from "../domain";
import { toExecutiveAction, toPlatformAction } from "./action-adapter";

describe("execution-engine Action compatibility", () => {
  it("round-trips the Action Center DTO through the canonical platform Action", () => {
    const legacy: ExecutiveAction = {
      id: "action-1",
      priorityId: "priority-1",
      propertyId: "property-1",
      source: "executive-intelligence",
      type: "pricing",
      title: "Adjust weekend rate",
      summary: "Raise the weekend rate.",
      priority: "high",
      status: "accepted",
      owner: { type: "user", id: "user-1", displayName: "Todd" },
      createdAt: "2026-07-19T12:00:00Z",
      acceptedAt: "2026-07-19T12:00:00Z",
    };

    const canonical = toPlatformAction(legacy);
    expect(canonical.type).toBe("pricing");
    expect(toExecutiveAction(canonical)).toEqual(legacy);
  });
});
