import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createOpportunity,
} from "../test-support/factories";

import {
  deduplicateOpportunities,
} from "./deduplicator";

describe("deduplicateOpportunities", () => {
  it("keeps the first opportunity for each identifier", () => {
    const first = createOpportunity({
      id: "shared-id",
      title: "First result",
    });

    const duplicate = createOpportunity({
      id: "shared-id",
      title: "Second result",
    });

    const unique = createOpportunity({
      id: "unique-id",
    });

    const result =
      deduplicateOpportunities([
        first,
        duplicate,
        unique,
      ]);

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe(
      "First result",
    );
    expect(result[1].id).toBe("unique-id");
  });

  it("preserves insertion order", () => {
    const result =
      deduplicateOpportunities([
        createOpportunity({ id: "third" }),
        createOpportunity({ id: "first" }),
        createOpportunity({ id: "second" }),
      ]);

    expect(
      result.map(
        (opportunity) => opportunity.id,
      ),
    ).toEqual([
      "third",
      "first",
      "second",
    ]);
  });
});
