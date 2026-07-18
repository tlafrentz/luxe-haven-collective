import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  ComparableProperty,
} from "../domain/entities/comparable-property";

import {
  ProviderType,
} from "../domain/enums/provider-type";

import {
  ProviderError,
  ProviderErrorCode,
} from "./providers/provider-error";

import {
  providerFailure,
  providerSuccess,
} from "./providers/provider-result";

import type {
  ComparableProvider,
} from "./providers/comparable-provider";

import {
  ComparableProviderRegistry,
} from "./comparable-provider-registry";

import {
  LookupComparables,
} from "./lookup-comparables";

describe(
  "LookupComparables",
  () => {
    it(
      "delegates to the default provider",
      async () => {
        const comparables =
          [
            {
              id: "comp-1",
            },
          ] as unknown as
            readonly ComparableProperty[];

        const getComparables =
          vi.fn<
            ComparableProvider[
              "getComparables"
            ]
          >(
            async () =>
              providerSuccess(
                comparables,
              ),
          );

        const registry =
          new ComparableProviderRegistry();

        registry.register(
          ProviderType.RentCast,
          {
            getComparables,
          },
        );

        const useCase =
          new LookupComparables({
            registry,
          });

        const result =
          await useCase.execute({
            address:
              " 123 Main St ",
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1750,
            radiusMiles: 5,
            limit: 10,
          });

        expect(result.ok)
          .toBe(true);

        expect(getComparables)
          .toHaveBeenCalledWith({
            address:
              "123 Main St",
            latitude: undefined,
            longitude: undefined,
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1750,
            radiusMiles: 5,
            limit: 10,
          });
      },
    );

    it(
      "propagates provider failures",
      async () => {
        const error =
          new ProviderError({
            provider:
              ProviderType.RentCast,
            code:
              ProviderErrorCode
                .NotFound,
            message:
              "No comparables found.",
          });

        const registry =
          new ComparableProviderRegistry();

        registry.register(
          ProviderType.RentCast,
          {
            getComparables:
              vi.fn(
                async () =>
                  providerFailure(
                    error,
                  ),
              ),
          },
        );

        const result =
          await new LookupComparables({
            registry,
          }).execute({
            address:
              "Missing Property",
          });

        expect(result.ok)
          .toBe(false);

        if (result.ok) {
          throw new Error(
            "Expected failure.",
          );
        }

        expect(result.error)
          .toBe(error);
      },
    );

    it(
      "rejects an empty address",
      async () => {
        const useCase =
          new LookupComparables({
            registry:
              new ComparableProviderRegistry(),
          });

        await expect(
          useCase.execute({
            address: " ",
          }),
        ).rejects.toThrow(
          "A property address is required.",
        );
      },
    );
  },
);
