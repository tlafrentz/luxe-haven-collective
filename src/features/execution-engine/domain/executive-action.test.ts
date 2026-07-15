import { describe, expect, it } from "vitest";

import type {
  ExecutiveAction,
} from "./executive-action";

describe("ExecutiveAction", () => {
  it("supports a newly proposed action", () => {
    const action: ExecutiveAction = {
      id: "action-1",
      propertyId: "property-1",

      source: "revenue-intelligence",
      type: "pricing",

      title: "Increase weekend pricing",
      summary: "Raise Friday and Saturday ADR.",

      priority: "high",
      status: "proposed",

      owner: {
        type: "user",
        id: "owner-1",
        displayName: "Todd",
      },

      createdAt: "2026-07-14T00:00:00Z",
    };

    expect(action.status).toBe("proposed");
    expect(action.outcome).toBeUndefined();
    expect(action.completedAt).toBeUndefined();
  });

  it("supports completed actions with outcomes", () => {
    const action: ExecutiveAction = {
      id: "action-2",
      propertyId: "property-1",

      source: "manual",
      type: "operations",

      title: "Replace smart lock batteries",
      summary: "Prevent guest lockouts.",

      priority: "medium",
      status: "completed",

      owner: {
        type: "team",
        id: "operations",
        displayName: "Operations",
      },

      createdAt: "2026-07-10T00:00:00Z",
      completedAt: "2026-07-12T12:00:00Z",

      outcome: {
        summary: "Completed successfully.",
        successful: true,
      },
    };

    expect(action.outcome?.successful).toBe(true);
    expect(action.status).toBe("completed");
  });
});
