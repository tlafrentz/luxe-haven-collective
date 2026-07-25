import type { PortfolioPropertyOperatingContext } from "../application/property-comparison";
import { createClient } from "@/lib/supabase/server";

type PropertyRow = Readonly<{ id: string; bedrooms: number | null; max_guests: number | null; property_type: string | null; created_at: string }>;
export class SupabasePropertyComparisonContextReader {
  async read(workspaceId: string, authorizedPropertyIds: readonly string[], period: Readonly<{ from: string; to: string }>): Promise<Readonly<Record<string, Partial<PortfolioPropertyOperatingContext>>>> {
    if (!authorizedPropertyIds.length) return {};
    const client = await createClient();
    const { data, error } = await client.from("properties").select("id,bedrooms,max_guests,property_type,created_at").eq("owner_id", workspaceId).in("id", [...authorizedPropertyIds]);
    if (error) throw new Error(`Unable to read Property comparison operating context: ${error.message}`);
    return Object.fromEntries(((data ?? []) as PropertyRow[]).map((property) => {
      const activeFrom = property.created_at.slice(0, 10) > period.from ? property.created_at.slice(0, 10) : period.from;
      const activeDays = inclusiveDays(activeFrom, period.to);
      return [property.id, {
        activeDays, bedrooms: property.bedrooms, maximumGuests: property.max_guests,
        propertyType: property.property_type, partialPeriod: activeFrom > period.from,
      }];
    }));
  }
}
function inclusiveDays(from: string, to: string) { return Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1); }
