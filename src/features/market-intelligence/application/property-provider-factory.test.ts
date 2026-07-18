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
  RentCastPropertyProvider,
} from "../infrastructure/rentcast/rentcast-property-provider";

import {
  PropertyProviderFactory,
  createPropertyProviderFactoryFromEnvironment,
} from "./property-provider-factory";

describe(
  "PropertyProviderFactory",
  () => {
    it(
      "creates a RentCast property provider",
      () => {
        const factory =
          new PropertyProviderFactory({
            rentCastApiKey:
              "test-api-key",
            fetchImplementation:
              vi.fn<typeof fetch>(),
          });

        const provider =
          factory.create(
            ProviderType.RentCast,
          );

        expect(provider)
          .toBeInstanceOf(
            RentCastPropertyProvider,
          );
      },
    );

    it(
      "requires a RentCast API key",
      () => {
        const factory =
          new PropertyProviderFactory({
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
          new PropertyProviderFactory({
            rentCastApiKey:
              "test-api-key",
          });

        expect(
          () =>
            factory.create(
              ProviderType.AirDna,
            ),
        ).toThrow(
          'Property provider "AirDNA" is not supported.',
        );
      },
    );

    it(
      "creates a factory from environment values",
      () => {
        const factory =
          createPropertyProviderFactoryFromEnvironment({
            NODE_ENV: "test",
            RENTCAST_API_KEY:
              "environment-api-key",
            RENTCAST_BASE_URL:
              "https://example.test/v1",
          });

        const provider =
          factory.create(
            ProviderType.RentCast,
          );

        expect(provider)
          .toBeInstanceOf(
            RentCastPropertyProvider,
          );
      },
    );
  },
);
