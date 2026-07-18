import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  ProviderErrorCode,
} from "../../application/providers/provider-error";

import {
  RentCastClient,
} from "./rentcast-client";

import {
  RentCastPropertyProvider,
} from "./rentcast-property-provider";

function createJsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
      },
    },
  );
}

function createFetchMock(
  responseFactory:
    (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => Promise<Response>,
) {
  return vi.fn<
    (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => Promise<Response>
  >(responseFactory);
}

describe(
  "RentCastPropertyProvider",
  () => {
    it(
      "maps a RentCast property record into a PropertyRecord",
      async () => {
        const fetchMock =
          createFetchMock(
            async () =>
              createJsonResponse([
                {
                  id:
                    "123-Main-St-Mesa-AZ-85201",
                  formattedAddress:
                    "123 Main St, Mesa, AZ 85201",
                  addressLine1:
                    "123 Main St",
                  city: "Mesa",
                  state: "AZ",
                  zipCode: "85201",
                  latitude: 33.4152,
                  longitude:
                    -111.8315,
                  propertyType:
                    "Single Family",
                  bedrooms: 3,
                  bathrooms: 2,
                  squareFootage: 1750,
                  lotSize: 7200,
                  yearBuilt: 1998,
                  lastSaleDate:
                    "2024-04-10T00:00:00.000Z",
                  lastSalePrice:
                    410000,
                  taxAssessments: {
                    "2024": {
                      year: 2024,
                      value: 395000,
                    },
                  },
                  propertyTaxes: {
                    "2024": {
                      year: 2024,
                      total: 2680,
                    },
                  },
                },
              ]),
          );

        const provider =
          new RentCastPropertyProvider({
            client:
              new RentCastClient({
                apiKey:
                  "test-api-key",
                fetchImplementation:
                  fetchMock,
              }),
          });

        const result =
          await provider.getProperty({
            address:
              "123 Main St, Mesa, AZ 85201",
          });

        expect(result.ok).toBe(true);

        if (!result.ok) {
          throw result.error;
        }

        expect(
          result.data.id,
        ).toBe(
          "123-Main-St-Mesa-AZ-85201",
        );

        expect(
          result.data.address.city,
        ).toBe("Mesa");

        expect(
          result.data
            .characteristics
            .bedrooms,
        ).toBe(3);

        expect(
          result.data
            .financialFacts
            .estimatedValue,
        ).toBe(395000);

        expect(
          result.data
            .financialFacts
            .annualPropertyTaxes,
        ).toBe(2680);

        expect(
          result.data
            .financialFacts
            .lastSaleDate,
        ).toEqual(
          new Date(
            "2024-04-10T00:00:00.000Z",
          ),
        );

        expect(
          result.data.hasCoordinates,
        ).toBe(true);

        expect(fetchMock)
          .toHaveBeenCalledOnce();

        const firstCall =
          fetchMock.mock.calls[0];

        expect(firstCall)
          .toBeDefined();

        if (!firstCall) {
          throw new Error(
            "Expected fetch to have been called.",
          );
        }

        const [
          requestUrl,
          requestOptions,
        ] = firstCall;

        expect(
          String(requestUrl),
        ).toContain(
          "/v1/properties",
        );

        expect(
          String(requestUrl),
        ).toContain(
          "address=123+Main+St",
        );

        expect(
          requestOptions?.headers,
        ).toEqual({
          Accept:
            "application/json",
          "X-Api-Key":
            "test-api-key",
        });
      },
    );

    it(
      "returns property search matches",
      async () => {
        const fetchMock =
          createFetchMock(
            async () =>
              createJsonResponse([
                {
                  id:
                    "property-1",
                  formattedAddress:
                    "123 Main St, Mesa, AZ 85201",
                  latitude:
                    33.4152,
                  longitude:
                    -111.8315,
                },
                {
                  id:
                    "property-2",
                  formattedAddress:
                    "123 Main Ave, Mesa, AZ 85201",
                },
              ]),
          );

        const provider =
          new RentCastPropertyProvider({
            client:
              new RentCastClient({
                apiKey:
                  "test-api-key",
                fetchImplementation:
                  fetchMock,
              }),
          });

        const result =
          await provider
            .searchProperties({
              address:
                "123 Main, Mesa, AZ",
            });

        expect(result.ok).toBe(true);

        if (!result.ok) {
          throw result.error;
        }

        expect(
          result.data,
        ).toHaveLength(2);

        expect(
          result.data[0],
        ).toEqual({
          providerPropertyId:
            "property-1",
          formattedAddress:
            "123 Main St, Mesa, AZ 85201",
          latitude: 33.4152,
          longitude: -111.8315,
        });
      },
    );

    it(
      "returns not found when no property record exists",
      async () => {
        const fetchMock =
          createFetchMock(
            async () =>
              createJsonResponse(
                [],
              ),
          );

        const provider =
          new RentCastPropertyProvider({
            client:
              new RentCastClient({
                apiKey:
                  "test-api-key",
                fetchImplementation:
                  fetchMock,
              }),
          });

        const result =
          await provider.getProperty({
            address:
              "Missing Property",
          });

        expect(result.ok).toBe(false);

        if (result.ok) {
          throw new Error(
            "Expected provider failure.",
          );
        }

        expect(
          result.error.code,
        ).toBe(
          ProviderErrorCode.NotFound,
        );
      },
    );

    it(
      "normalizes RentCast authentication failures",
      async () => {
        const fetchMock =
          createFetchMock(
            async () =>
              createJsonResponse(
                {
                  message:
                    "Unauthorized",
                },
                401,
              ),
          );

        const provider =
          new RentCastPropertyProvider({
            client:
              new RentCastClient({
                apiKey:
                  "invalid-api-key",
                fetchImplementation:
                  fetchMock,
              }),
          });

        const result =
          await provider.getProperty({
            address:
              "123 Main St",
          });

        expect(result.ok).toBe(false);

        if (result.ok) {
          throw new Error(
            "Expected provider failure.",
          );
        }

        expect(
          result.error.code,
        ).toBe(
          ProviderErrorCode
            .AuthenticationFailed,
        );

        expect(
          result.error.statusCode,
        ).toBe(401);
      },
    );

    it(
      "ignores incomplete property search matches",
      async () => {
        const fetchMock =
          createFetchMock(
            async () =>
              createJsonResponse([
                {
                  id:
                    "complete",
                  formattedAddress:
                    "123 Main St",
                },
                {
                  id:
                    "missing-address",
                },
                {
                  formattedAddress:
                    "Missing id",
                },
              ]),
          );

        const provider =
          new RentCastPropertyProvider({
            client:
              new RentCastClient({
                apiKey:
                  "test-api-key",
                fetchImplementation:
                  fetchMock,
              }),
          });

        const result =
          await provider
            .searchProperties({
              address:
                "123 Main",
            });

        expect(result.ok).toBe(true);

        if (!result.ok) {
          throw result.error;
        }

        expect(result.data).toEqual([
          {
            providerPropertyId:
              "complete",
            formattedAddress:
              "123 Main St",
            latitude: undefined,
            longitude: undefined,
          },
        ]);
      },
    );
  },
);
