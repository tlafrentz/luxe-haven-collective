"use server";

import { z } from "zod";

import { getSessionProfile } from "@/lib/auth/session";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { resolveInvestmentMarketContextAtRuntime } from "@/features/market-intelligence/str/infrastructure/investment-market-context-runtime";
import type { StrMarketContextFailureCode } from "@/features/market-intelligence/str/application/resolve-investment-market-context";
import { ProviderError } from "@/features/market-intelligence/application/providers/provider-error";
import {
  AmbiguousSubjectPropertyError,
  SubjectPropertyNotFoundError,
} from "@/features/market-intelligence/application/lookup-subject-property";

const inputSchema = z.object({
  address: z.string().trim().min(5).max(300),
});

export type PropertySyncFailureCode =
  | "INVALID_ADDRESS_INPUT"
  | "PROPERTY_NOT_FOUND"
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

export type InvestmentPropertySyncResult =
  | Readonly<{
    ok: true;
    status: "complete" | "str-limited" | "str-unavailable" | "coordinates-missing";
    data: {
      address1?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      propertyType?: string;
      bedrooms?: number;
      bathrooms?: number;
      squareFeet?: number;
      yearBuilt?: number;
      purchasePrice?: number;
      projectedAdr?: number;
      projectedOccupancyPercentage?: number;
      annualRevenue?: number;
      subjectPropertyId: string;
      subjectPropertySnapshotId: string;
      marketSnapshotId?: string;
      propertySource: "RealtyAPI";
      marketSource?: "AirROI";
      limitationCode?: StrMarketContextFailureCode;
      warnings: readonly string[];
    };
  }>
  | Readonly<{ ok: false; code: PropertySyncFailureCode; message: string; manualFallbackAvailable: true }>;

export async function syncInvestmentPropertyAction(input: unknown): Promise<InvestmentPropertySyncResult> {
  const correlationId = `property-sync:${crypto.randomUUID()}`;
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    recordPropertySyncDiagnostic(correlationId, "response-mapping", "INVALID_ADDRESS_INPUT", false);
    return failure("INVALID_ADDRESS_INPUT", propertyFailureMessage("INVALID_ADDRESS_INPUT"));
  }
  const { user } = await getSessionProfile();
  if (!user) {
    recordPropertySyncDiagnostic(correlationId, "authorization", "SUBJECT_AUTHORIZATION_FAILED", false);
    return failure("SUBJECT_AUTHORIZATION_FAILED", propertyFailureMessage("SUBJECT_AUTHORIZATION_FAILED"));
  }
  if (!process.env.REALTY_API_KEY?.trim()) {
    recordPropertySyncDiagnostic(correlationId, "configuration", "PROPERTY_PROVIDER_UNAVAILABLE", false);
    return failure("PROPERTY_PROVIDER_UNAVAILABLE", "Property intelligence is not configured.");
  }

  let workspaceId: string;
  try {
    const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id);
    if (!["owner", "administrator"].includes(access.role)) {
      recordPropertySyncDiagnostic(correlationId, "authorization", "SUBJECT_AUTHORIZATION_FAILED", false);
      return failure("SUBJECT_AUTHORIZATION_FAILED", "You are not authorized to sync this workspace.");
    }
    workspaceId = access.workspaceId;
  } catch {
    recordPropertySyncDiagnostic(correlationId, "authorization", "SUBJECT_AUTHORIZATION_FAILED", false);
    return failure("SUBJECT_AUTHORIZATION_FAILED", "You are not authorized to sync this workspace.");
  }

  try {
    const context = await resolveInvestmentMarketContextAtRuntime({
      ownerId: user.id,
      workspaceId,
      address: parsed.data.address,
      property: {},
      correlationId,
      requestedAt: new Date(),
      forceRefresh: true,
    });
    const property = context.subjectProperty;
    if (!property || !context.subjectPropertySnapshotId) {
      recordPropertySyncDiagnostic(correlationId, "response-mapping", "PROPERTY_MAPPING_FAILED", true);
      return failure("PROPERTY_MAPPING_FAILED", "Property data could not be resolved. Confirm the address and try again.");
    }
    const market = context.marketSnapshot;
    const status = context.failureCode === "COORDINATES_MISSING"
      ? "coordinates-missing"
      : context.failureCode === "INSUFFICIENT_COMPARABLE_COVERAGE"
        ? "str-limited"
        : context.failureCode
          ? "str-unavailable"
          : "complete";
    const result = {
      ok: true,
      status,
      data: {
        ...(property.address.street.value ? { address1: property.address.street.value } : {}),
        ...(property.address.city.value ? { city: property.address.city.value } : {}),
        ...(property.address.state.value ? { state: property.address.state.value } : {}),
        ...(property.address.postalCode.value ? { postalCode: property.address.postalCode.value } : {}),
        ...(property.physical.propertyType.value ? { propertyType: property.physical.propertyType.value } : {}),
        ...(property.physical.bedrooms.value !== null ? { bedrooms: property.physical.bedrooms.value } : {}),
        ...(property.physical.bathrooms.value !== null ? { bathrooms: property.physical.bathrooms.value } : {}),
        ...(property.physical.livingAreaSquareFeet.value !== null ? { squareFeet: property.physical.livingAreaSquareFeet.value } : {}),
        ...(property.physical.yearBuilt.value !== null ? { yearBuilt: property.physical.yearBuilt.value } : {}),
        ...((property.listing.listPrice.value ?? property.listing.lastSalePrice.value) !== null
          ? { purchasePrice: (property.listing.listPrice.value ?? property.listing.lastSalePrice.value)! }
          : {}),
        ...(market?.revenueEstimate?.projectedAdr ? { projectedAdr: market.revenueEstimate.projectedAdr.amount } : {}),
        ...(market?.revenueEstimate?.projectedOccupancy ? { projectedOccupancyPercentage: market.revenueEstimate.projectedOccupancy.value } : {}),
        ...(market?.revenueEstimate?.projectedAnnualRevenue ? { annualRevenue: market.revenueEstimate.projectedAnnualRevenue.amount } : {}),
        subjectPropertyId: property.id,
        subjectPropertySnapshotId: context.subjectPropertySnapshotId,
        ...(market ? { marketSnapshotId: market.id, marketSource: "AirROI" as const } : {}),
        propertySource: "RealtyAPI",
        ...(context.failureCode ? { limitationCode: context.failureCode } : {}),
        warnings: context.warnings,
      },
    } satisfies InvestmentPropertySyncResult;
    recordPropertySyncDiagnostic(correlationId, "resolved", "SUCCESS", true);
    return result;
  } catch (error) {
    const code = classifyPropertyFailure(error);
    const diagnostic = propertySyncDiagnostic(code, error);
    recordPropertySyncDiagnostic(correlationId, diagnostic.boundary, code, diagnostic.outboundRequest);
    return failure(code, propertyFailureMessage(code));
  }
}

function failure(code: PropertySyncFailureCode, message: string): Extract<InvestmentPropertySyncResult, { ok: false }> {
  return { ok: false, code, message: `${message} Manual analysis remains available.`, manualFallbackAvailable: true };
}

export function classifyPropertyFailure(error: unknown): PropertySyncFailureCode {
  if (error instanceof SubjectPropertyNotFoundError || (error instanceof Error && error.name === "SubjectPropertyNotFoundError")) {
    return "PROPERTY_NOT_FOUND";
  }
  if (error instanceof AmbiguousSubjectPropertyError || (error instanceof Error && error.name === "AmbiguousSubjectPropertyError")) {
    return "PROPERTY_MAPPING_FAILED";
  }
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "not-found") return "PROPERTY_NOT_FOUND";
  if (code === "authentication-failed" || code === "access-denied") return "PROPERTY_PROVIDER_UNAUTHORIZED";
  if (code === "rate-limited") return "PROPERTY_PROVIDER_RATE_LIMITED";
  if (code === "invalid-response") return "PROPERTY_RESPONSE_INVALID";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("persistence") || message.includes("snapshot")) return "SUBJECT_PERSISTENCE_FAILED";
  return "PROPERTY_PROVIDER_UNAVAILABLE";
}

export function propertyFailureMessage(code: PropertySyncFailureCode): string {
  if (code === "INVALID_ADDRESS_INPUT") return "Enter a complete street address before syncing.";
  if (code === "SUBJECT_AUTHORIZATION_FAILED") return "You are not authorized to sync property data.";
  if (code === "PROPERTY_NOT_FOUND") return "Property could not be resolved. Confirm the address and try again.";
  if (code === "PROPERTY_PROVIDER_RATE_LIMITED") return "Property intelligence is temporarily rate limited.";
  if (code === "PROPERTY_PROVIDER_UNAUTHORIZED") return "Property intelligence could not be authorized.";
  if (code === "PROPERTY_RESPONSE_INVALID" || code === "PROPERTY_MAPPING_FAILED") return "Property data was returned but could not be mapped.";
  if (code === "SUBJECT_PERSISTENCE_FAILED") return "Property data was resolved but canonical persistence failed.";
  return "Property intelligence is temporarily unavailable.";
}

export function propertySyncDiagnostic(
  code: PropertySyncFailureCode,
  error?: unknown,
): Readonly<{ boundary: PropertySyncDiagnosticBoundary; outboundRequest: boolean }> {
  if (code === "SUBJECT_AUTHORIZATION_FAILED") return { boundary: "authorization", outboundRequest: false };
  if (code === "INVALID_ADDRESS_INPUT") return { boundary: "response-mapping", outboundRequest: false };
  if (code === "SUBJECT_PERSISTENCE_FAILED") return { boundary: "canonical-persistence", outboundRequest: true };
  if (code === "PROPERTY_RESPONSE_INVALID" || code === "PROPERTY_MAPPING_FAILED" || code === "PROPERTY_NOT_FOUND") {
    return { boundary: "response-mapping", outboundRequest: true };
  }
  if (code === "PROPERTY_PROVIDER_UNAUTHORIZED" || code === "PROPERTY_PROVIDER_RATE_LIMITED") {
    return { boundary: "authorization", outboundRequest: true };
  }
  const providerCode = error instanceof ProviderError ? error.code : undefined;
  return providerCode === "not-configured"
    ? { boundary: "adapter-activation", outboundRequest: false }
    : { boundary: "request-execution", outboundRequest: true };
}

function recordPropertySyncDiagnostic(
  correlationId: string,
  boundary: PropertySyncDiagnosticBoundary,
  classification: PropertySyncFailureCode | "SUCCESS",
  outboundRequest: boolean,
): void {
  console.info(JSON.stringify({
    event: "investment_property_sync_diagnostic",
    correlationId,
    boundary,
    classification,
    outboundRequest,
  }));
}
