import type { PortfolioPeriod } from "@/features/portfolio";
import type { PortfolioProjectionSource, PortfolioPropertySource } from "@/features/portfolio/application/read-model";
import { ConfidenceLevel } from "@/platform/scoring";
import { createClient } from "@/lib/supabase/server";

type PropertyRow = Readonly<{ id: string; name: string; city: string; state: string; status: string; property_type: string | null; updated_at: string }>;
type BookingRow = Readonly<{ id: string; property_id: string; check_in: string; check_out: string; total_amount: number; status: string }>;

export class SupabasePortfolioProjectionSource implements PortfolioProjectionSource {
  async listWorkspaceProperties(workspaceId: string) {
    const client = await createClient();
    const { data, error } = await client.from("property_workspace_configuration").select("property_id,inclusion").eq("workspace_id", workspaceId);
    if (error) throw new Error(`Unable to read Portfolio property scope: ${error.message}`);
    return (data ?? []).map((row) => ({ propertyId: row.property_id, included: row.inclusion === "included" }));
  }

  async loadAuthorizedProperties(workspaceId: string, propertyIds: readonly string[], period: PortfolioPeriod): Promise<readonly PortfolioPropertySource[]> {
    if (!propertyIds.length) return [];
    const client = await createClient();
    const [{ data: properties, error: propertyError }, { data: bookings, error: bookingError }, { data: configurations, error: configurationError }] = await Promise.all([
      client.from("properties").select("id,name,city,state,status,property_type,updated_at").eq("owner_id", workspaceId).in("id", [...propertyIds]),
      client.from("bookings").select("id,property_id,check_in,check_out,total_amount,status").in("property_id", [...propertyIds]).neq("status", "cancelled").gte("check_in", period.current.from).lte("check_in", period.current.to),
      client.from("property_workspace_configuration").select("property_id,currency_override").eq("workspace_id", workspaceId).in("property_id", [...propertyIds]),
    ]);
    if (propertyError) throw new Error(`Unable to read authorized Portfolio properties: ${propertyError.message}`);
    if (bookingError) throw new Error(`Unable to read authorized Portfolio bookings: ${bookingError.message}`);
    if (configurationError) throw new Error(`Unable to read Portfolio reporting currency: ${configurationError.message}`);
    const currencies = new Set((configurations ?? []).map(({ currency_override }) => currency_override ?? "USD"));
    if (currencies.size > 1 || (currencies.size === 1 && !currencies.has("USD"))) {
      throw new Error("Portfolio currency configuration requires an explicit conversion policy before aggregation.");
    }
    const rows = (bookings ?? []) as BookingRow[];
    return ((properties ?? []) as PropertyRow[]).map((property) => this.project(property, rows.filter(({ property_id }) => property_id === property.id), period));
  }

  private project(property: PropertyRow, bookings: readonly BookingRow[], period: PortfolioPeriod): PortfolioPropertySource {
    const occupiedNights = bookings.reduce((total, booking) => total + nights(booking.check_in, booking.check_out), 0);
    const availableNights = inclusiveDays(period.current.from, period.current.to);
    const revenue = bookings.reduce((total, booking) => total + Number(booking.total_amount), 0);
    const ageHours = (Date.now() - Date.parse(property.updated_at)) / 3_600_000;
    const freshness = ageHours <= 24 ? "current" : ageHours <= 72 ? "stale" : "degraded";
    const observedAt = property.updated_at;
    const evidence = [
      { id: `revenue:${property.id}:${period.current.from}:${period.current.to}`, propertyId: property.id, kind: "revenue" as const, statement: `${bookings.length} canonical non-cancelled bookings support reported revenue.`, observedAt, confidence: bookings.length ? ConfidenceLevel.HIGH : ConfidenceLevel.LOW },
      { id: `bookings:${property.id}:${period.current.from}:${period.current.to}`, propertyId: property.id, kind: "bookings" as const, statement: `${bookings.length} canonical bookings fall in the selected period.`, observedAt, confidence: ConfidenceLevel.HIGH },
      { id: `operational:${property.id}:${observedAt}`, propertyId: property.id, kind: "operational" as const, statement: `Property operational record last observed ${observedAt}.`, observedAt, confidence: freshness === "current" ? ConfidenceLevel.HIGH : ConfidenceLevel.LOW },
    ];
    return Object.freeze({
      propertyId: property.id,
      name: property.name,
      status: property.status === "archived" ? "archived" : "active",
      market: [property.city, property.state].filter(Boolean).join(", ") || null,
      operatingModel: property.property_type,
      metrics: Object.freeze({
        grossRevenue: revenue,
        adr: occupiedNights ? revenue / occupiedNights : null,
        occupancy: availableNights ? occupiedNights / availableNights : null,
        revpar: availableNights ? revenue / availableNights : null,
        netOperatingIncome: null,
        cashFlow: null,
        margin: null,
        bookingCount: bookings.length,
        activeStays: bookings.filter((booking) => booking.check_in <= isoToday() && booking.check_out > isoToday()).length,
        openActions: 0,
        operationalIssues: freshness === "current" ? 0 : 1,
      }),
      observations: freshness === "current" ? [] : [{ id: `observation:stale:${property.id}`, propertyId: property.id, kind: "operational-data-stale" as const, statement: `${property.name} operational data is ${freshness}.`, observedAt, evidenceIds: evidence.map(({ id }) => id) }],
      evidence,
      confidence: bookings.length ? ConfidenceLevel.HIGH : ConfidenceLevel.LOW,
      freshness,
    });
  }
}

function nights(from: string, to: string) { return Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)); }
function inclusiveDays(from: string, to: string) { return nights(from, to) + 1; }
function isoToday() { return new Date().toISOString().slice(0, 10); }
