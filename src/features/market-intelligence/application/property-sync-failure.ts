import {
  AmbiguousSubjectPropertyError,
  SubjectPropertyNotFoundError,
} from "@/features/market-intelligence/application/lookup-subject-property";
import { ProviderError } from "@/features/market-intelligence/application/providers/provider-error";

export type PropertySyncFailureCode =
  | "INVALID_ADDRESS_INPUT"
  | "PROPERTY_NOT_FOUND"
  | "PROPERTY_AMBIGUOUS"
  | "PROPERTY_PROVIDER_UNAUTHORIZED"
  | "PROPERTY_PROVIDER_UNAVAILABLE"
  | "PROPERTY_PROVIDER_RATE_LIMITED"
  | "PROPERTY_RESPONSE_INVALID"
  | "PROPERTY_MAPPING_FAILED"
  | "SUBJECT_PERSISTENCE_FAILED"
  | "SUBJECT_AUTHORIZATION_FAILED";

export type PropertySyncDiagnosticBoundary =
  | "adapter-activation"
  | "configuration"
  | "request-execution"
  | "response-mapping"
  | "authorization"
  | "canonical-persistence"
  | "resolved";

export function classifyPropertyFailure(
  error: unknown,
): PropertySyncFailureCode {
  if (
    error instanceof SubjectPropertyNotFoundError ||
    (error instanceof Error &&
      error.name === "SubjectPropertyNotFoundError")
  ) {
    return "PROPERTY_NOT_FOUND";
  }

  if (
    error instanceof AmbiguousSubjectPropertyError ||
    (error instanceof Error &&
      error.name === "AmbiguousSubjectPropertyError")
  ) {
    return "PROPERTY_AMBIGUOUS";
  }

  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";

  if (code === "not-found") {
    return "PROPERTY_NOT_FOUND";
  }

  if (code === "authentication-failed" || code === "access-denied") {
    return "PROPERTY_PROVIDER_UNAUTHORIZED";
  }

  if (code === "rate-limited") {
    return "PROPERTY_PROVIDER_RATE_LIMITED";
  }

  if (code === "invalid-response") {
    return "PROPERTY_RESPONSE_INVALID";
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("persistence") || message.includes("snapshot")) {
    return "SUBJECT_PERSISTENCE_FAILED";
  }

  return "PROPERTY_PROVIDER_UNAVAILABLE";
}

export function propertyFailureMessage(
  code: PropertySyncFailureCode,
): string {
  if (code === "INVALID_ADDRESS_INPUT") {
    return "Enter a complete street address before syncing.";
  }

  if (code === "SUBJECT_AUTHORIZATION_FAILED") {
    return "You are not authorized to sync property data.";
  }

  if (code === "PROPERTY_NOT_FOUND") {
    return "Property could not be resolved. Confirm the address and try again.";
  }

  if (code === "PROPERTY_AMBIGUOUS") {
    return "Multiple properties matched this address. Refine the address and try again.";
  }

  if (code === "PROPERTY_PROVIDER_RATE_LIMITED") {
    return "Property intelligence is temporarily rate limited.";
  }

  if (code === "PROPERTY_PROVIDER_UNAUTHORIZED") {
    return "Property intelligence could not be authorized.";
  }

  if (
    code === "PROPERTY_RESPONSE_INVALID" ||
    code === "PROPERTY_MAPPING_FAILED"
  ) {
    return "Property data was returned but could not be mapped.";
  }

  if (code === "SUBJECT_PERSISTENCE_FAILED") {
    return "Property data was resolved but canonical persistence failed.";
  }

  return "Property intelligence is temporarily unavailable.";
}

export function propertySyncDiagnostic(
  code: PropertySyncFailureCode,
  error?: unknown,
): Readonly<{
  boundary: PropertySyncDiagnosticBoundary;
  outboundRequest: boolean;
}> {
  if (code === "SUBJECT_AUTHORIZATION_FAILED") {
    return {
      boundary: "authorization",
      outboundRequest: false,
    };
  }

  if (code === "INVALID_ADDRESS_INPUT") {
    return {
      boundary: "response-mapping",
      outboundRequest: false,
    };
  }

  if (code === "SUBJECT_PERSISTENCE_FAILED") {
    return {
      boundary: "canonical-persistence",
      outboundRequest: true,
    };
  }

  if (
    code === "PROPERTY_RESPONSE_INVALID" ||
    code === "PROPERTY_MAPPING_FAILED" ||
    code === "PROPERTY_AMBIGUOUS" ||
    code === "PROPERTY_NOT_FOUND"
  ) {
    return {
      boundary: "response-mapping",
      outboundRequest: true,
    };
  }

  if (
    code === "PROPERTY_PROVIDER_UNAUTHORIZED" ||
    code === "PROPERTY_PROVIDER_RATE_LIMITED"
  ) {
    return {
      boundary: "authorization",
      outboundRequest: true,
    };
  }

  const providerCode =
    error instanceof ProviderError ? error.code : undefined;

  return providerCode === "not-configured"
    ? {
        boundary: "adapter-activation",
        outboundRequest: false,
      }
    : {
        boundary: "request-execution",
        outboundRequest: true,
      };
}
