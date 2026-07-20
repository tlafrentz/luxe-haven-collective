import { describe, expect, it } from "vitest";
import { Identifier } from "../../kernel";
import { Action } from "./action";
import { ActionCollection } from "./action-collection";

function action(priority: "critical" | "high" | "medium" | "low" = "high") {
  return Action.create({
    id: Identifier.create(`action-${priority}`),
    title: "Review operating plan",
    summary: "Confirm the next operational step.",
    type: "operations",
    priority,
    owner: { type: "team", id: "ops", displayName: "Operations" },
    decisionIds: [],
    createdAt: new Date("2026-07-19T12:00:00Z"),
  });
}

describe("Action", () => {
  it("owns the reusable action lifecycle without mutating prior states", () => {
    const proposed = action();
    const accepted = proposed.accept(new Date("2026-07-19T13:00:00Z"));
    const started = accepted.start(new Date("2026-07-19T14:00:00Z"));
    const completed = started.complete(new Date("2026-07-19T15:00:00Z"), {
      summary: "The plan was confirmed.", successful: true,
    });
    const measured = completed.measure(new Date("2026-07-20T15:00:00Z"), {
      measuredImpact: { cycleTimeHours: 2 }, lessonsLearned: ["  Assign an owner early.  "],
    });

    expect(proposed.status).toBe("proposed");
    expect(measured.status).toBe("measured");
    expect(measured.outcome?.measuredImpact).toEqual({ cycleTimeHours: 2 });
    expect(measured.outcome?.lessonsLearned).toEqual(["Assign an owner early."]);
  });

  it("rejects lifecycle transitions that are not supported", () => {
    expect(() => action().start(new Date())).toThrow(
      'Cannot transition action from "proposed" to "in-progress".',
    );
  });

  it("supports manual actions while retaining optional Decision provenance", () => {
    const manual = action();
    expect(manual.decisionIds).toEqual([]);
  });
});

describe("ActionCollection", () => {
  it("queries and orders canonical Actions", () => {
    const collection = ActionCollection.create([action("low"), action("critical")]);
    expect(collection.priorityFirst().toArray().map((value) => value.priority)).toEqual(["critical", "low"]);
    expect(collection.ofPriority("critical").size).toBe(1);
  });
});
