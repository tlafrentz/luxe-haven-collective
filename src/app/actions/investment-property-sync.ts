"use server";

import { z } from "zod";

import { getSessionProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupSubjectProperty } from "@/features/market-intelligence/application/lookup-subject-property";
import { createRealtyApiPropertyProvider } from "@/features/market-intelligence/infrastructure/realtyapi/provider";
import { SupabasePropertySnapshotRepository } from "@/features/market-intelligence/infrastructure/property-snapshot-repository";
import { buildStrMarketQuery } from "@/features/market-intelligence/str/application/build-str-market-query";
import { AirRoiClient } from "@/features/market-intelligence/str/infrastructure/airroi/airroi-client";
import { getAirRoiConfig } from "@/features/market-intelligence/str/infrastructure/airroi/airroi-config";
import { AirRoiProvider } from "@/features/market-intelligence/str/infrastructure/airroi/airroi-provider";

const inputSchema = z.object({
  address: z.string().trim().min(5).max(300),
});

export type InvestmentPropertySyncResult =
  | Readonly<{
    ok: true;
    data: {
      address1?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      propertyType?: string;
      bedrooms?: number;
      bathrooms?: number;
      squareFeet?: number;
      purchasePrice?: number;
      projectedAdr?: number;
      projectedOccupancyPercentage?: number;
      annualRevenue?: number;
      propertySource: "RealtyAPI";
      marketSource?: "AirROI";
      warnings: readonly string[];
    };
  }>
  | Readonly<{ ok: false; message: string }>;

export async function syncInvestmentPropertyAction(input: unknown): Promise<InvestmentPropertySyncResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a complete street address before syncing." };
  const { user } = await getSessionProfile();
  if (!user) return { ok: false, message: "Sign in before syncing property data." };
  if (!process.env.REALTY_API_KEY) return { ok: false, message: "RealtyAPI is not configured." };

  try {
    const config = getAirRoiConfig();
    const property = await lookupSubjectProperty({ address: parsed.data.address, refresh: true }, {
      provider: createRealtyApiPropertyProvider({
        apiKey: process.env.REALTY_API_KEY,
        ...(process.env.REALTY_API_BASE_URL ? { baseUrl: process.env.REALTY_API_BASE_URL } : {}),
        timeoutMs: config.timeoutMs,
      }),
      snapshots: new SupabasePropertySnapshotRepository(createAdminClient() as never),
      snapshotTtlDays: config.propertySnapshotTtlDays,
    });

    const warnings: string[] = property.missingFields.map(field => `RealtyAPI did not return ${field}.`);
    let market: Awaited<ReturnType<AirRoiProvider["retrieve"]>> | undefined;
    if (config.enabled && config.apiKey) {
      try {
        const query = buildStrMarketQuery(property, {
          accommodates: Math.max(1, (property.physical.bedrooms.value ?? 1) * 2),
          entirePlace: true,
          currency: "USD",
        });
        market = await new AirRoiProvider(new AirRoiClient({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          timeoutMs: config.timeoutMs,
          maxRetries: config.maxRetries,
        }), config).retrieve(query, {
          correlationId: `property-sync:${crypto.randomUUID()}`,
          snapshotId: `property-sync:${crypto.randomUUID()}`,
        });
        warnings.push(...market.warnings);
      } catch {
        warnings.push("AirROI market data could not be synced. RealtyAPI property data was still applied.");
      }
    } else {
      warnings.push("AirROI is not configured; only RealtyAPI property data was applied.");
    }

    return {
      ok: true,
      data: {
        ...(property.address.street.value ? { address1: property.address.street.value } : {}),
        ...(property.address.city.value ? { city: property.address.city.value } : {}),
        ...(property.address.state.value ? { state: property.address.state.value } : {}),
        ...(property.address.postalCode.value ? { postalCode: property.address.postalCode.value } : {}),
        ...(property.physical.propertyType.value ? { propertyType: property.physical.propertyType.value } : {}),
        ...(property.physical.bedrooms.value !== null ? { bedrooms: property.physical.bedrooms.value } : {}),
        ...(property.physical.bathrooms.value !== null ? { bathrooms: property.physical.bathrooms.value } : {}),
        ...(property.physical.livingAreaSquareFeet.value !== null ? { squareFeet: property.physical.livingAreaSquareFeet.value } : {}),
        ...((property.listing.listPrice.value ?? property.listing.lastSalePrice.value) !== null
          ? { purchasePrice: (property.listing.listPrice.value ?? property.listing.lastSalePrice.value)! }
          : {}),
        ...(market?.revenueEstimate?.projectedAdr ? { projectedAdr: market.revenueEstimate.projectedAdr.amount } : {}),
        ...(market?.revenueEstimate?.projectedOccupancy ? { projectedOccupancyPercentage: market.revenueEstimate.projectedOccupancy.value } : {}),
        ...(market?.revenueEstimate?.projectedAnnualRevenue ? { annualRevenue: market.revenueEstimate.projectedAnnualRevenue.amount } : {}),
        propertySource: "RealtyAPI",
        ...(market ? { marketSource: "AirROI" as const } : {}),
        warnings: [...new Set(warnings)],
      },
    };
  } catch {
    return { ok: false, message: "Property data could not be synced. Confirm the address and try again." };
  }
}
