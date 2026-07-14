import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  PortfolioChange,
} from "../domain";

import {
  buildPortfolioChanges,
} from "./build-portfolio-changes";

function createChange(
  overrides: Partial<PortfolioChange> = {},
): PortfolioChange {
  return {
    id: "change-1",
    type: "system-update",
    tone: "informational",
    pillar: "operations",
    propertyId: "property-1",
    title: "Test change",
    description:
      "A test portfolio change occurred.",
    occurredAt:
      "2026-07-13T15:00:00.000Z",
    ...overrides,
  };
}

describe("buildPortfolioChanges", () => {
  it("merges daily and intelligence changes in reverse chronological order", () => {
    const result =
      buildPortfolioChanges({
        dailyChanges: [
          createChange({
            id: "daily",
            occurredAt:
              "2026-07-13T18:00:00.000Z",
          }),
        ],
        intelligenceChanges: [
          createChange({
            id: "intelligence",
            occurredAt:
              "2026-07-13T19:00:00.000Z",
          }),
        ],
      });

    expect(
      result.map((change) => change.id),
    ).toEqual([
      "intelligence",
      "daily",
    ]);
  });

  it("removes duplicate changes by id", () => {
    const result =
      buildPortfolioChanges({
        dailyChanges: [
          createChange({
            id: "duplicate",
            title: "Daily version",
          }),
        ],
        intelligenceChanges: [
          createChange({
            id: "duplicate",
            title:
              "Intelligence version",
          }),
        ],
      });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe(
      "Intelligence version",
    );
  });

  it("limits the resulting feed", () => {
    const result =
      buildPortfolioChanges({
        dailyChanges: Array.from(
          { length: 10 },
          (_, index) =>
            createChange({
              id: `daily-${index}`,
              occurredAt: new Date(
                Date.UTC(
                  2026,
                  6,
                  13,
                  10,
                  index,
                ),
              ).toISOString(),
            }),
        ),
        intelligenceChanges: [],
        limit: 5,
      });

    expect(result).toHaveLength(5);
  });

  it("returns an empty array when no changes exist", () => {
    expect(
      buildPortfolioChanges({
        dailyChanges: [],
        intelligenceChanges: [],
      }),
    ).toEqual([]);
  });
});
