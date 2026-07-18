import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ProviderType,
} from "../../domain/enums/provider-type";

import {
  ProviderError,
  ProviderErrorCode,
} from "./provider-error";

import {
  providerFailure,
  providerSuccess,
  unwrapProviderResult,
} from "./provider-result";

describe(
  "provider result",
  () => {
    it(
      "creates a successful provider result",
      () => {
        const result =
          providerSuccess({
            address:
              "123 Main Street",
          });

        expect(result.ok).toBe(true);

        if (!result.ok) {
          throw new Error(
            "Expected provider success.",
          );
        }

        expect(result.data).toEqual({
          address:
            "123 Main Street",
        });
      },
    );

    it(
      "creates a failed provider result",
      () => {
        const error =
          new ProviderError({
            provider:
              ProviderType.RentCast,
            code:
              ProviderErrorCode
                .RateLimited,
            message:
              "Provider rate limit reached.",
            retryable: true,
            statusCode: 429,
          });

        const result =
          providerFailure(error);

        expect(result.ok).toBe(false);

        if (result.ok) {
          throw new Error(
            "Expected provider failure.",
          );
        }

        expect(
          result.error.code,
        ).toBe(
          ProviderErrorCode.RateLimited,
        );

        expect(
          result.error.retryable,
        ).toBe(true);

        expect(
          result.error.statusCode,
        ).toBe(429);
      },
    );

    it(
      "unwraps a successful result",
      () => {
        const result =
          providerSuccess("property");

        expect(
          unwrapProviderResult(result),
        ).toBe("property");
      },
    );

    it(
      "throws the provider error when unwrapping a failure",
      () => {
        const error =
          new ProviderError({
            provider:
              ProviderType.Unknown,
            code:
              ProviderErrorCode
                .Unavailable,
            message:
              "Provider unavailable.",
            retryable: true,
          });

        const result =
          providerFailure(error);

        expect(
          () =>
            unwrapProviderResult(
              result,
            ),
        ).toThrow(error);
      },
    );
  },
);
