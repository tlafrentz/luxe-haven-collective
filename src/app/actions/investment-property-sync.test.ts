import { describe, expect, it } from "vitest";

import { SubjectPropertyNotFoundError } from "@/features/market-intelligence/application/lookup-subject-property";
import {
  classifyPropertyFailure,
  propertyFailureMessage,
  propertySyncDiagnostic,
  type PropertySyncFailureCode,
} from "@/features/market-intelligence/application/property-sync-failure";
import {
  ProviderError,
  ProviderErrorCode,
} from "@/features/market-intelligence/application/providers/provider-error";
import { ProviderType } from "@/features/market-intelligence/domain/enums/provider-type";

describe("investment property sync failure boundaries", () => {
  it.each([
    [
      "INVALID_ADDRESS_INPUT",
      "Enter a complete street address",
      "response-mapping",
      false,
    ],
    [
      "PROPERTY_NOT_FOUND",
      "Confirm the address",
      "response-mapping",
      true,
    ],
    [
      "PROPERTY_PROVIDER_UNAUTHORIZED",
      "could not be authorized",
      "authorization",
      true,
    ],
    [
      "PROPERTY_PROVIDER_UNAVAILABLE",
      "temporarily unavailable",
      "request-execution",
      true,
    ],
    [
      "PROPERTY_PROVIDER_RATE_LIMITED",
      "temporarily rate limited",
      "authorization",
      true,
    ],
    [
      "PROPERTY_RESPONSE_INVALID",
      "could not be mapped",
      "response-mapping",
      true,
    ],
    [
      "PROPERTY_MAPPING_FAILED",
      "could not be mapped",
      "response-mapping",
      true,
    ],
    [
      "SUBJECT_PERSISTENCE_FAILED",
      "canonical persistence failed",
      "canonical-persistence",
      true,
    ],
    [
      "SUBJECT_AUTHORIZATION_FAILED",
      "not authorized",
      "authorization",
      false,
    ],
  ] as const)(
    "maps %s to accurate safe feedback and diagnostics",
    (code, message, boundary, outboundRequest) => {
      expect(propertyFailureMessage(code)).toContain(message);
      expect(propertySyncDiagnostic(code)).toEqual({
        boundary,
        outboundRequest,
      });
      expect(propertyFailureMessage(code)).not.toMatch(
        /RealtyAPI|api key|response body/i,
      );
    },
  );

  it("classifies empty provider results as not found", () => {
    expect(
      classifyPropertyFailure(
        new SubjectPropertyNotFoundError(),
      ),
    ).toBe("PROPERTY_NOT_FOUND");
  });

  it("distinguishes adapter activation from outbound request execution", () => {
    const error = new ProviderError({
      provider: ProviderType.RealtyApi,
      code: ProviderErrorCode.NotConfigured,
      message: "not configured",
    });

    expect(
      propertySyncDiagnostic(
        "PROPERTY_PROVIDER_UNAVAILABLE",
        error,
      ),
    ).toEqual({
      boundary: "adapter-activation",
      outboundRequest: false,
    });
  });

  it("keeps every failure message provider-neutral", () => {
    const codes: readonly PropertySyncFailureCode[] = [
      "INVALID_ADDRESS_INPUT",
      "PROPERTY_NOT_FOUND",
      "PROPERTY_PROVIDER_UNAUTHORIZED",
      "PROPERTY_PROVIDER_UNAVAILABLE",
      "PROPERTY_PROVIDER_RATE_LIMITED",
      "PROPERTY_RESPONSE_INVALID",
      "PROPERTY_MAPPING_FAILED",
      "SUBJECT_PERSISTENCE_FAILED",
      "SUBJECT_AUTHORIZATION_FAILED",
    ];

    for (const code of codes) {
      expect(propertyFailureMessage(code)).not.toContain(
        "RealtyAPI",
      );
    }
  });
});
