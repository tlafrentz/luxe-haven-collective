"use server";

import { z } from "zod";

import { getSessionProfile } from "@/lib/auth/session";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { resolveInvestmentMarketContextAtRuntime } from "@/features/market-intelligence/str/infrastructure/investment-market-context-runtime";
import type { StrMarketContextFailureCode } from "@/features/market-intelligence/str/application/resolve-investment-market-context";

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
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return failure("INVALID_ADDRESS_INPUT", "Enter a complete street address before syncing.");
  const { user } = await getSessionProfile();
  if (!user) return failure("SUBJECT_AUTHORIZATION_FAILED", "Sign in before syncing property data.");
  if (!process.env.REALTY_API_KEY) return failure("PROPERTY_PROVIDER_UNAVAILABLE", "Property intelligence is not configured.");

  let workspaceId: string;
  try {
    const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id);
    if (!["owner", "administrator"].includes(access.role)) {
      return failure("SUBJECT_AUTHORIZATION_FAILED", "You are not authorized to sync this workspace.");
    }
    workspaceId = access.workspaceId;
  } catch {
    return failure("SUBJECT_AUTHORIZATION_FAILED", "You are not authorized to sync this workspace.");
  }

  try {
    const context = await resolveInvestmentMarketContextAtRuntime({
      ownerId: user.id,
      workspaceId,
      address: parsed.data.address,
      property: {},
      correlationId: `property-sync:${crypto.randomUUID()}`,
      requestedAt: new Date(),
      forceRefresh: true,
    });
    const property = context.subjectProperty;
    if (!property || !context.subjectPropertySnapshotId) {
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
    return {
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
    };
  } catch (error) {
    const code = classifyPropertyFailure(error);
    return failure(code, propertyFailureMessage(code));
  }
}

function failure(code: PropertySyncFailureCode, message: string): Extract<InvestmentPropertySyncResult, { ok: false }> {
  return { ok: false, code, message: `${message} Manual analysis remains available.`, manualFallbackAvailable: true };
}

function classifyPropertyFailure(error: unknown): PropertySyncFailureCode {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "not-found") return "PROPERTY_NOT_FOUND";
  if (code === "authentication-failed" || code === "access-denied") return "PROPERTY_PROVIDER_UNAUTHORIZED";
  if (code === "rate-limited") return "PROPERTY_PROVIDER_RATE_LIMITED";
  if (code === "invalid-response") return "PROPERTY_RESPONSE_INVALID";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("persistence") || message.includes("snapshot")) return "SUBJECT_PERSISTENCE_FAILED";
  return "PROPERTY_PROVIDER_UNAVAILABLE";
}

function propertyFailureMessage(code: PropertySyncFailureCode): string {
  if (code === "PROPERTY_NOT_FOUND") return "Property could not be resolved. Confirm the address and try again.";
  if (code === "PROPERTY_PROVIDER_RATE_LIMITED") return "Property intelligence is temporarily rate limited.";
  if (code === "PROPERTY_PROVIDER_UNAUTHORIZED") return "Property intelligence authentication is unavailable.";
  if (code === "PROPERTY_RESPONSE_INVALID" || code === "PROPERTY_MAPPING_FAILED") return "Property data was returned but could not be mapped.";
  if (code === "SUBJECT_PERSISTENCE_FAILED") return "Property data was resolved but canonical persistence failed.";
  return "Property intelligence is temporarily unavailable.";
}
