import { describe, expect, it } from "vitest";
import { ProviderErrorCode } from "../application/providers/provider-error";
import {
  classifyProviderFailure,
  fingerprintSafeProviderRequest,
  hashDiagnosticValue,
  operationFromRentCastUrl,
  safeRequestMetadataFromUrl,
} from "./provider-diagnostics";

describe("MI-002 provider diagnostics primitives", () => {
  it.each([
    [400, ProviderErrorCode.InvalidRequest, "INVALID_REQUEST"],
    [401, ProviderErrorCode.AuthenticationFailed, "AUTHENTICATION"],
    [403, ProviderErrorCode.AccessDenied, "AUTHORIZATION"],
    [404, ProviderErrorCode.NotFound, "SUBJECT_NOT_FOUND"],
    [408, ProviderErrorCode.Unknown, "TIMEOUT"],
    [429, ProviderErrorCode.RateLimited, "RATE_LIMITED"],
    [500, ProviderErrorCode.Unavailable, "PROVIDER_FAILURE"],
    [undefined, ProviderErrorCode.RequestFailed, "TRANSPORT_FAILURE"],
    [200, ProviderErrorCode.InvalidResponse, "PROVIDER_SERIALIZATION"],
  ] as const)("classifies status %s and code %s", (status, code, expected) => {
    expect(classifyProviderFailure({ status, code })).toBe(expected);
  });

  it("hashes exact addresses and fingerprints only safe request metadata", () => {
    const url = new URL("https://api.rentcast.io/v1/avm/value?address=123%20Main%20St%2C%20Mesa%2C%20AZ%2085201&propertyType=Single%20Family&bedrooms=3&bathrooms=2&squareFootage=1800&maxRadius=5&compCount=10");
    const metadata = safeRequestMetadataFromUrl(url, "purchase");
    expect(metadata).toEqual({
      addressHash: hashDiagnosticValue("123 Main St, Mesa, AZ 85201"),
      propertyType: "Single Family",
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1800,
      radius: 5,
      comparableCount: 10,
      acquisitionRoute: "purchase",
    });
    expect(JSON.stringify(metadata)).not.toContain("123 Main");
    expect(fingerprintSafeProviderRequest("sale-estimate", metadata)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("derives canonical operation names without provider selection logic", () => {
    expect(operationFromRentCastUrl(new URL("https://api.rentcast.io/v1/properties"))).toBe("property-resolution");
    expect(operationFromRentCastUrl(new URL("https://api.rentcast.io/v1/avm/value"))).toBe("sale-estimate");
    expect(operationFromRentCastUrl(new URL("https://api.rentcast.io/v1/avm/rent/long-term"))).toBe("rent-estimate");
  });
});
