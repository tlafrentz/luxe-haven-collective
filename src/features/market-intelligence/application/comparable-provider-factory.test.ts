import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  ProviderType,
} from "../domain/enums/provider-type";

import {
  RentCastComparableProvider,
} from "../infrastructure/rentcast/rentcast-comparable-provider";

import {
  ComparableProviderFactory,
} from "./comparable-provider-factory";

describe(
  "ComparableProviderFactory",
  () => {
    it(
      "creates a RentCast comparable provider",
      () => {
        const factory =
          new ComparableProviderFactory({
            rentCastApiKey:
              "test-api-key",
            fetchImplementation:
              vi.fn<typeof fetch>(),
          });

        expect(
          factory.create(
            ProviderType.RentCast,
          ),
        ).toBeInstanceOf(
          RentCastComparableProvider,
        );
      },
    );

    it(
      "requires a RentCast API key",
      () => {
        const factory =
          new ComparableProviderFactory({
            rentCastApiKey: " ",
          });

        expect(
          () =>
            factory.create(
              ProviderType.RentCast,
            ),
        ).toThrow(
          "RENTCAST_API_KEY is required",
        );
      },
    );

    it(
      "rejects unsupported providers",
      () => {
        const factory =
          new ComparableProviderFactory({
            rentCastApiKey:
              "test-api-key",
          });

        expect(
          () =>
            factory.create(
              ProviderType.AirDna,
            ),
        ).toThrow(
          'Comparable provider "AirDNA" is not supported.',
        );
      },
    );
  },
);
