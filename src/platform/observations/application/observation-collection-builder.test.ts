import {
  describe,
  expect,
  it,
} from "vitest";

import {
  Identifier,
} from "../../kernel";
import {
  Observation,
} from "../domain/observation";
import {
  ObservationCollection,
} from "../domain/observation-collection";
import {
  ObservationBuilder,
} from "./observation-builder";
import {
  ObservationCollectionBuilder,
} from "./observation-collection-builder";

function observation(
  id: string,
  type: string,
) {
  return Observation.create({
    id: Identifier.create(id),
    type,
    subject: {
      type: "property",
      id: "property-001",
    },
    label: type,
    value: 1,
    source: {
      type: "internal-calculation",
      name: "Test",
    },
    observedAt: new Date(
      "2026-07-19T12:00:00.000Z",
    ),
    recordedAt: new Date(
      "2026-07-19T12:00:00.000Z",
    ),
  });
}

describe(
  "ObservationCollectionBuilder",
  () => {
    it("builds a collection incrementally", () => {
      const first = observation(
        "observation-001",
        "market-adr",
      );
      const second = observation(
        "observation-002",
        "market-occupancy",
      );

      const builder =
        ObservationCollectionBuilder
          .create()
          .add(first)
          .add(second);

      expect(builder.size).toBe(2);
      expect(
        builder.build().toArray(),
      ).toEqual([first, second]);
    });

    it("adds a completed observation builder", () => {
      const observationBuilder =
        ObservationBuilder.create()
          .withType("gap-night-count")
          .concerning({
            type: "property",
            id: "property-001",
          })
          .withLabel("Gap nights")
          .withValue(4)
          .fromSource({
            type: "internal-calculation",
            name: "Revenue Intelligence",
          })
          .observedAt(
            new Date(
              "2026-07-19T12:00:00.000Z",
            ),
          )
          .recordedAt(
            new Date(
              "2026-07-19T12:00:00.000Z",
            ),
          );

      const collection =
        ObservationCollectionBuilder
          .create()
          .addBuilt(
            observationBuilder,
          )
          .build();

      expect(collection.size).toBe(1);
      expect(
        collection.latestObserved()
          ?.value,
      ).toBe(4);
    });

    it("starts from an existing collection", () => {
      const first = observation(
        "observation-001",
        "market-adr",
      );

      const source =
        ObservationCollection.create([
          first,
        ]);

      const result =
        ObservationCollectionBuilder
          .from(source)
          .add(
            observation(
              "observation-002",
              "market-occupancy",
            ),
          )
          .build();

      expect(source.size).toBe(1);
      expect(result.size).toBe(2);
    });

    it("delegates duplicate protection to the domain collection", () => {
      const first = observation(
        "observation-001",
        "market-adr",
      );
      const duplicate = observation(
        "observation-001",
        "market-occupancy",
      );

      expect(() =>
        ObservationCollectionBuilder
          .create()
          .add(first)
          .add(duplicate)
          .build(),
      ).toThrow(
        "Observation collection cannot contain duplicate observation ids.",
      );
    });
  },
);
