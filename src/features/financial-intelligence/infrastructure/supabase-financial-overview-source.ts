import { Money } from "@/platform/kernel";
import { createClient } from "@/lib/supabase/server";
import { FinancialTransaction, type FinancialAccount, type FinancialIdentity } from "../domain";
import type { FinancialSource } from "../application";
import type { FinancialPropertyCatalog } from "./financial-overview-projection-adapter";

type BookingRow = Readonly<{ id: string; property_id: string; check_in: string; total_amount: number; currency: string | null; updated_at: string }>;

export class SupabaseFinancialOverviewSource implements FinancialSource, FinancialPropertyCatalog {
  async getIdentity(workspaceId: string): Promise<FinancialIdentity> {
    const client = await createClient();
    const { data, error } = await client.from("owners").select("id,timezone,currency").eq("id", workspaceId).single();
    if (error) throw new Error(`Unable to read Financial identity: ${error.message}`);
    return Object.freeze({
      workspaceId, organizationId: String(data.id), reportingCurrency: data.currency ?? "USD",
      fiscalYearStartMonth: 1, timezone: data.timezone ?? "America/Chicago",
      reportingStandards: Object.freeze(["management-reporting"]), accountingMethod: "accrual",
    });
  }
  async listAccounts(workspaceId: string): Promise<readonly FinancialAccount[]> {
    return Object.freeze([{ id: `account:${workspaceId}:recognized-revenue`, workspaceId, code: "4000", name: "Recognized Accommodation Revenue", category: "revenue", subcategory: "Accommodation", active: true }]);
  }
  async listTransactions(scope: Parameters<FinancialSource["listTransactions"]>[0]) {
    const propertyIds = scope.propertyId ? [scope.propertyId] : [...(scope.propertyIds ?? [])];
    if (!propertyIds.length) return Object.freeze([]);
    const client = await createClient();
    const { data, error } = await client.from("bookings")
      .select("id,property_id,check_in,total_amount,currency,updated_at")
      .in("property_id", propertyIds).neq("status", "cancelled")
      .gte("check_in", scope.period.from).lte("check_in", scope.period.to);
    if (error) throw new Error(`Unable to read canonical recognized revenue: ${error.message}`);
    const identity = await this.getIdentity(scope.workspaceId);
    return Object.freeze(((data ?? []) as BookingRow[]).map(row => {
      const currency = row.currency ?? identity.reportingCurrency;
      if (currency !== identity.reportingCurrency) throw new Error("FINANCIAL_CURRENCY_MISMATCH");
      return FinancialTransaction.create({
        id: `booking-revenue:${row.id}`, accountId: `account:${scope.workspaceId}:recognized-revenue`,
        workspaceId: scope.workspaceId, propertyId: row.property_id, amount: Money.of(Number(row.total_amount), currency),
        category: "accommodation", measurement: "measured", effectiveDate: row.check_in, postingDate: row.check_in,
        source: { provider: "canonical-bookings", externalId: row.id }, status: "posted",
        evidenceIds: [`booking:${row.id}`],
      });
    }));
  }
  async getSynchronization(workspaceId: string) {
    const client = await createClient();
    const { data, error } = await client.from("properties").select("updated_at").eq("owner_id", workspaceId).order("updated_at", { ascending: true }).limit(1);
    if (error) throw new Error(`Unable to read Financial freshness: ${error.message}`);
    return Object.freeze({ lastSuccessfulAt: data?.[0]?.updated_at as string | undefined, expectedProviders: 1, connectedProviders: 1, historyMonths: 1 });
  }
  async list(workspaceId: string) {
    const client = await createClient();
    const [{ data: properties, error: propertyError }, { data: configurations, error: configurationError }] = await Promise.all([
      client.from("properties").select("id,name,status,city,state,property_type").eq("owner_id", workspaceId),
      client.from("property_workspace_configuration").select("property_id,inclusion").eq("workspace_id", workspaceId),
    ]);
    if (propertyError || configurationError) throw new Error(`Unable to resolve Financial scope: ${propertyError?.message ?? configurationError?.message}`);
    const configuration = new Map((configurations ?? []).map(row => [row.property_id, row.inclusion]));
    return Object.freeze((properties ?? []).map(row => ({
      propertyId: String(row.id), label: String(row.name), included: configuration.get(row.id) === "included",
      reportingEligible: row.status !== "archived",
      market: [row.city, row.state].filter(Boolean).join(", ") || undefined,
      operatingModel: row.property_type || undefined,
    })));
  }
}
