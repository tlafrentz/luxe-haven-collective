import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  PropertyRecord,
} from "../domain/entities/property-record";

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
  PropertyProvider,
} from "./providers/property-provider";

import {
  LookupProperty,
  lookupProperty,
} from "./lookup-property";

import {
  PropertyProviderRegistry,
} from "./property-provider-registry";

function createPropertyRecord():
  PropertyRecord {
  return {
    id: "property-1",
    address: {
      formatted:
        "123 Main St, Mesa, AZ 85201",
      addressLine1:
        "123 Main St",
      city: "Mesa",
      state: "AZ",
      postalCode: "85201",
      country: "US",
    },
    characteristics: {
      propertyType:
        "Single Family",
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1750,
      lotSquareFeet: 7200,
      yearBuilt: 1998,
    },
    financialFacts: {
      estimatedValue: 395000,
      annualPropertyTaxes: 2680,
      lastSalePrice: 410000,
      lastSaleDate:
        new Date(
          "2024-04-10T00:00:00.000Z",
        ),
    },
    provenance: {} as PropertyRecord["provenance"],
    coordinates: {
      latitude: 33.4152,
      longitude: -111.8315,
    },
    hasCoordinates: true,
  } as PropertyRecord;
}

function createProvider(
  getProperty:
    PropertyProvider["getProperty"],
): PropertyProvider {
  return {
    getProperty,
    searchProperties:
      vi.fn<
        PropertyProvider[
          "searchProperties"
        ]
      >(),
  };
}

describe(
  "LookupProperty",
  () => {
    it(
      "delegates to the default provider",
      async () => {
        const property =
          createPropertyRecord();

        const getProperty =
          vi.fn<
            PropertyProvider[
              "getProperty"
            ]
          >(
            async () =>
              providerSuccess(
                property,
              ),
          );

        const registry =
          new PropertyProviderRegistry();

        registry.register(
          ProviderType.RentCast,
          createProvider(
            getProperty,
          ),
        );

        const useCase =
          new LookupProperty({
            registry,
          });

        const result =
          await useCase.execute({
            address:
              " 123 Main St, Mesa, AZ 85201 ",
          });

        expect(result.ok)
          .toBe(true);

        expect(getProperty)
          .toHaveBeenCalledWith({
            address:
              "123 Main St, Mesa, AZ 85201",
          });

        if (!result.ok) {
          throw result.error;
        }

        expect(result.data)
          .toBe(property);
      },
    );

    it(
      "uses an explicitly selected provider",
      async () => {
        const property =
          createPropertyRecord();

        const rentCastGet =
          vi.fn<
            PropertyProvider[
              "getProperty"
            ]
          >();

        const manualGet =
          vi.fn<
            PropertyProvider[
              "getProperty"
            ]
          >(
            async () =>
              providerSuccess(
                property,
              ),
          );

        const registry =
          new PropertyProviderRegistry();

        registry.register(
          ProviderType.RentCast,
          createProvider(
            rentCastGet,
          ),
        );

        registry.register(
          ProviderType.Manual,
          createProvider(
            manualGet,
          ),
        );

        const useCase =
          new LookupProperty({
            registry,
          });

        const result =
          await useCase.execute({
            address:
              "123 Main St",
            provider:
              ProviderType.Manual,
          });

        expect(result.ok)
          .toBe(true);

        expect(manualGet)
          .toHaveBeenCalledOnce();

        expect(rentCastGet)
          .not.toHaveBeenCalled();
      },
    );

    it(
      "propagates provider failures",
      async () => {
        const providerError =
          new ProviderError({
            provider:
              ProviderType.RentCast,
            code:
              ProviderErrorCode
                .NotFound,
            message:
              "Property not found.",
          });

        const getProperty =
          vi.fn<
            PropertyProvider[
              "getProperty"
            ]
          >(
            async () =>
              providerFailure(
                providerError,
              ),
          );

        const registry =
          new PropertyProviderRegistry();

        registry.register(
          ProviderType.RentCast,
          createProvider(
            getProperty,
          ),
        );

        const result =
          await lookupProperty(
            {
              registry,
            },
            {
              address:
                "Missing Property",
            },
          );

        expect(result.ok)
          .toBe(false);

        if (result.ok) {
          throw new Error(
            "Expected provider failure.",
          );
        }

        expect(result.error)
          .toBe(providerError);
      },
    );

    it(
      "rejects an empty address",
      async () => {
        const registry =
          new PropertyProviderRegistry();

        const useCase =
          new LookupProperty({
            registry,
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

    it(
      "rejects an unregistered provider",
      async () => {
        const registry =
          new PropertyProviderRegistry();

        const useCase =
          new LookupProperty({
            registry,
          });

        await expect(
          useCase.execute({
            address:
              "123 Main St",
          }),
        ).rejects.toThrow(
          'No property provider is registered for "RentCast".',
        );
      },
    );
  },
);
