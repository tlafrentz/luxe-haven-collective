"use server";

import { z } from "zod";

import {
  classifyPropertyFailure,
  propertyFailureMessage,
  propertySyncDiagnostic,
  type PropertySyncDiagnosticBoundary,
  type PropertySyncFailureCode,
} from "@/features/market-intelligence/application/property-sync-failure";
import type { StrMarketContextFailureCode } from "@/features/market-intelligence/str/application/resolve-investment-market-context";
import { resolveInvestmentMarketContextAtRuntime } from "@/features/market-intelligence/str/infrastructure/investment-market-context-runtime";
import {
  resolveWorkspaceAccessContext,
  SupabaseTeamAccessRepository,
} from "@/features/workspace";
import { getSessionProfile } from "@/lib/auth/session";

const inputSchema = z.object({
  address: z.string().trim().min(5).max(300),
});

export type InvestmentPropertySyncResult =
  | Readonly<{
      ok: true;
      status:
        | "complete"
        | "str-limited"
        | "str-unavailable"
        | "coordinates-missing";
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
  | Readonly<{
      ok: false;
      code: PropertySyncFailureCode;
      message: string;
      manualFallbackAvailable: true;
    }>;

export async function syncInvestmentPropertyAction(
  input: unknown,
): Promise<InvestmentPropertySyncResult> {
  const correlationId = `property-sync:${crypto.randomUUID()}`;
  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    recordPropertySyncDiagnostic(
      correlationId,
      "response-mapping",
      "INVALID_ADDRESS_INPUT",
      false,
    );

    return failure(
      "INVALID_ADDRESS_INPUT",
      propertyFailureMessage("INVALID_ADDRESS_INPUT"),
    );
  }

  const { user } = await getSessionProfile();

  if (!user) {
    recordPropertySyncDiagnostic(
      correlationId,
      "authorization",
      "SUBJECT_AUTHORIZATION_FAILED",
      false,
    );

    return failure(
      "SUBJECT_AUTHORIZATION_FAILED",
      propertyFailureMessage("SUBJECT_AUTHORIZATION_FAILED"),
    );
  }

  if (!process.env.REALTY_API_KEY?.trim()) {
    recordPropertySyncDiagnostic(
      correlationId,
      "configuration",
      "PROPERTY_PROVIDER_UNAVAILABLE",
      false,
    );

    return failure(
      "PROPERTY_PROVIDER_UNAVAILABLE",
      "Property intelligence is not configured.",
    );
  }

  let workspaceId: string;

  try {
    const access = await resolveWorkspaceAccessContext(
      new SupabaseTeamAccessRepository(),
      user.id,
    );

    if (!["owner", "administrator"].includes(access.role)) {
      recordPropertySyncDiagnostic(
        correlationId,
        "authorization",
        "SUBJECT_AUTHORIZATION_FAILED",
        false,
      );

      return failure(
        "SUBJECT_AUTHORIZATION_FAILED",
        "You are not authorized to sync this workspace.",
      );
    }

    workspaceId = access.workspaceId;
  } catch {
    recordPropertySyncDiagnostic(
      correlationId,
      "authorization",
      "SUBJECT_AUTHORIZATION_FAILED",
      false,
    );

    return failure(
      "SUBJECT_AUTHORIZATION_FAILED",
      "You are not authorized to sync this workspace.",
    );
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
    }, {
      emit(event, attributes) {
        recordPropertySyncStageDiagnostic(correlationId, event, attributes);
      },
    });

    const property = context.subjectProperty;

    if (!property || !context.subjectPropertySnapshotId) {
      recordPropertySyncDiagnostic(
        correlationId,
        "response-mapping",
        "PROPERTY_MAPPING_FAILED",
        true,
      );

      return failure(
        "PROPERTY_MAPPING_FAILED",
        "Property data could not be resolved. Confirm the address and try again.",
      );
    }

    const market = context.marketSnapshot;

    const status =
      context.failureCode === "COORDINATES_MISSING"
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
        ...(property.address.street.value
          ? { address1: property.address.street.value }
          : {}),
        ...(property.address.city.value
          ? { city: property.address.city.value }
          : {}),
        ...(property.address.state.value
          ? { state: property.address.state.value }
          : {}),
        ...(property.address.postalCode.value
          ? { postalCode: property.address.postalCode.value }
          : {}),
        ...(property.physical.propertyType.value
          ? { propertyType: property.physical.propertyType.value }
          : {}),
        ...(property.physical.bedrooms.value !== null
          ? { bedrooms: property.physical.bedrooms.value }
          : {}),
        ...(property.physical.bathrooms.value !== null
          ? { bathrooms: property.physical.bathrooms.value }
          : {}),
        ...(property.physical.livingAreaSquareFeet.value !== null
          ? {
              squareFeet:
                property.physical.livingAreaSquareFeet.value,
            }
          : {}),
        ...(property.physical.yearBuilt.value !== null
          ? { yearBuilt: property.physical.yearBuilt.value }
          : {}),
        ...((property.listing.listPrice.value ??
          property.listing.lastSalePrice.value) !== null
          ? {
              purchasePrice:
                (property.listing.listPrice.value ??
                  property.listing.lastSalePrice.value)!,
            }
          : {}),
        ...(market?.revenueEstimate?.projectedAdr
          ? {
              projectedAdr:
                market.revenueEstimate.projectedAdr.amount,
            }
          : {}),
        ...(market?.revenueEstimate?.projectedOccupancy
          ? {
              projectedOccupancyPercentage:
                market.revenueEstimate.projectedOccupancy.value,
            }
          : {}),
        ...(market?.revenueEstimate?.projectedAnnualRevenue
          ? {
              annualRevenue:
                market.revenueEstimate.projectedAnnualRevenue.amount,
            }
          : {}),
        subjectPropertyId: property.id,
        subjectPropertySnapshotId:
          context.subjectPropertySnapshotId,
        ...(market
          ? {
              marketSnapshotId: market.id,
              marketSource: "AirROI" as const,
            }
          : {}),
        propertySource: "RealtyAPI",
        ...(context.failureCode
          ? { limitationCode: context.failureCode }
          : {}),
        warnings: context.warnings,
      },
    } satisfies InvestmentPropertySyncResult;

    recordPropertySyncDiagnostic(
      correlationId,
      "resolved",
      "SUCCESS",
      true,
    );

    return result;
  } catch (error) {
    const code = classifyPropertyFailure(error);
    const diagnostic = propertySyncDiagnostic(code, error);

    recordPropertySyncDiagnostic(
      correlationId,
      diagnostic.boundary,
      code,
      diagnostic.outboundRequest,
    );

    return failure(code, propertyFailureMessage(code));
  }
}

function failure(
  code: PropertySyncFailureCode,
  message: string,
): Extract<InvestmentPropertySyncResult, { ok: false }> {
  return {
    ok: false,
    code,
    message: `${message} Manual analysis remains available.`,
    manualFallbackAvailable: true,
  };
}

function recordPropertySyncDiagnostic(
  correlationId: string,
  boundary: PropertySyncDiagnosticBoundary,
  classification: PropertySyncFailureCode | "SUCCESS",
  outboundRequest: boolean,
): void {
  console.info(
    JSON.stringify({
      event: "investment_property_sync_diagnostic",
      correlationId,
      boundary,
      classification,
      outboundRequest,
    }),
  );
}

function recordPropertySyncStageDiagnostic(
  correlationId: string,
  stage: string,
  attributes: Readonly<Record<string, unknown>>,
): void {
  console.info(JSON.stringify({
    event: "investment_property_sync_stage",
    correlationId,
    stage,
    ...(typeof attributes.candidateCount === "number"
      ? { candidateCount: attributes.candidateCount }
      : {}),
    ...(typeof attributes.compatibleCandidateCount === "number"
      ? { compatibleCandidateCount: attributes.compatibleCandidateCount }
      : {}),
    ...(typeof attributes.snapshotVersion === "number"
      ? { snapshotVersion: attributes.snapshotVersion }
      : {}),
    ...(typeof attributes.snapshotId === "string"
      ? { snapshotId: attributes.snapshotId }
      : {}),
    ...(typeof attributes.provider === "string"
      ? { provider: attributes.provider }
      : {}),
    ...(typeof attributes.operation === "string"
      ? { operation: attributes.operation }
      : {}),
    ...(typeof attributes.attempt === "number"
      ? { attempt: attributes.attempt }
      : {}),
    ...(typeof attributes.durationMs === "number"
      ? { durationMs: attributes.durationMs }
      : {}),
    ...(typeof attributes.code === "string"
      ? { code: attributes.code }
      : {}),
    ...(typeof attributes.errorName === "string"
      ? { errorName: attributes.errorName }
      : {}),
    ...(typeof attributes.hasCoordinates === "boolean"
      ? { hasCoordinates: attributes.hasCoordinates }
      : {}),
    ...(typeof attributes.hasRevenueEstimate === "boolean"
      ? { hasRevenueEstimate: attributes.hasRevenueEstimate }
      : {}),
    ...(typeof attributes.eligibleComparableCount === "number"
      ? { eligibleComparableCount: attributes.eligibleComparableCount }
      : {}),
    ...(typeof attributes.minimumComparableCount === "number"
      ? { minimumComparableCount: attributes.minimumComparableCount }
      : {}),
    ...(typeof attributes.sufficientCoverage === "boolean"
      ? { sufficientCoverage: attributes.sufficientCoverage }
      : {}),
    ...(typeof attributes.completeness === "string"
      ? { completeness: attributes.completeness }
      : {}),
    ...(typeof attributes.limitationCode === "string"
      ? { limitationCode: attributes.limitationCode }
      : {}),
    ...(typeof attributes.reasonCode === "string"
      ? { reasonCode: attributes.reasonCode }
      : {}),
    ...(typeof attributes.classification === "string"
      ? { classification: attributes.classification }
      : {}),
    ...(typeof attributes.source === "string"
      ? { source: attributes.source }
      : {}),
    ...(typeof attributes.featureEnabled === "boolean"
      ? { featureEnabled: attributes.featureEnabled }
      : {}),
    ...(typeof attributes.providerConfigured === "boolean"
      ? { providerConfigured: attributes.providerConfigured }
      : {}),
    ...(typeof attributes.cacheHit === "boolean"
      ? { cacheHit: attributes.cacheHit }
      : {}),
    ...(typeof attributes.snapshotCreated === "boolean"
      ? { snapshotCreated: attributes.snapshotCreated }
      : {}),
    ...(typeof attributes.terminalEmitted === "boolean"
      ? { terminalEmitted: attributes.terminalEmitted }
      : {}),
  }));
}
