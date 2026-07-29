import { Money } from "@/platform/kernel";
import { createClient } from "@/lib/supabase/server";
import { FinancialTransaction, type FinancialAccount, type FinancialIdentity } from "../domain";
import type { FinancialSource } from "../application";
import type { FinancialPropertyCatalog } from "./financial-overview-projection-adapter";

type BookingRow = Readonly<{
  id: string;
  property_id: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  currency: string | null;
  updated_at: string;
}>;
type AccountRow = Readonly<{ id:string;workspace_id:string;code:string;name:string;category:FinancialAccount["category"];subcategory:string|null;active:boolean }>;
type TransactionRow = Readonly<{ id:string;workspace_id:string;account_id:string;property_id:string|null;amount_minor:number;currency:string;measurement:FinancialTransaction["props"]["measurement"];effective_date:string;posting_date:string|null;source_provider:string;source_external_id:string|null;status:FinancialTransaction["props"]["status"];evidence_ids:string[] }>;

const DAY_MS = 86_400_000;

function dateValue(value: string): number {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`).getTime();
}

function nextDate(value: string): string {
  return new Date(dateValue(value) + DAY_MS).toISOString().slice(0, 10);
}

function overlappingNights(checkIn: string, checkOut: string, from: string, to: string): number {
  const start = Math.max(dateValue(checkIn), dateValue(from));
  const end = Math.min(dateValue(checkOut), dateValue(nextDate(to)));
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

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
    const client=await createClient(),{data,error}=await client.from("financial_accounts").select("id,workspace_id,code,name,category,subcategory,active").eq("workspace_id",workspaceId);
    if(error)throw new Error(`Unable to read canonical financial accounts: ${error.message}`);
    return Object.freeze([
      { id: `account:${workspaceId}:recognized-revenue`, workspaceId, code: "4000", name: "Recognized Accommodation Revenue", category: "revenue", subcategory: "accommodation", active: true } as const,
      ...((data??[])as AccountRow[]).map(row=>Object.freeze({id:row.id,workspaceId:row.workspace_id,code:row.code,name:row.name,category:row.category,subcategory:row.subcategory??undefined,active:row.active})),
    ]);
  }
  async listTransactions(scope: Parameters<FinancialSource["listTransactions"]>[0]) {
    const propertyIds = scope.propertyId ? [scope.propertyId] : [...(scope.propertyIds ?? [])];
    if (!propertyIds.length) return Object.freeze([]);
    const client = await createClient();
    const [bookingResult,transactionResult] = await Promise.all([
      client.from("bookings").select("id,property_id,check_in,check_out,total_amount,currency,updated_at")
        .in("property_id", propertyIds).neq("status", "cancelled")
        .lt("check_in", nextDate(scope.period.to)).gt("check_out", scope.period.from),
      client.from("financial_transactions").select("id,workspace_id,account_id,property_id,amount_minor,currency,measurement,effective_date,posting_date,source_provider,source_external_id,status,evidence_ids")
        .eq("workspace_id",scope.workspaceId).in("property_id",propertyIds).gte("effective_date",scope.period.from).lte("effective_date",scope.period.to),
    ]);
    if (bookingResult.error||transactionResult.error) throw new Error(`Unable to read canonical financial observations: ${bookingResult.error?.message??transactionResult.error?.message}`);
    const identity = await this.getIdentity(scope.workspaceId);
    const revenue=((bookingResult.data ?? []) as BookingRow[]).flatMap(row => {
      const currency = row.currency ?? identity.reportingCurrency;
      if (currency !== identity.reportingCurrency) throw new Error("FINANCIAL_CURRENCY_MISMATCH");
      const stayNights = Math.max(0, Math.round((dateValue(row.check_out) - dateValue(row.check_in)) / DAY_MS));
      const recognizedNights = overlappingNights(row.check_in, row.check_out, scope.period.from, scope.period.to);
      if (stayNights === 0 || recognizedNights === 0) return [];
      const effectiveDate = row.check_in > scope.period.from ? row.check_in : scope.period.from;
      return [FinancialTransaction.create({
        id: `booking-revenue:${row.id}`, accountId: `account:${scope.workspaceId}:recognized-revenue`,
        workspaceId: scope.workspaceId, propertyId: row.property_id,
        amount: Money.of(Number(row.total_amount) * (recognizedNights / stayNights), currency),
        category: "accommodation", measurement: "actual", effectiveDate, postingDate: effectiveDate,
        source: { provider: "canonical-bookings", externalId: row.id }, status: "posted",
        evidenceIds: [`booking:${row.id}`],
      })];
    });
    const observations=((transactionResult.data??[])as TransactionRow[]).map(row=>FinancialTransaction.create({
      id:row.id,accountId:row.account_id,workspaceId:row.workspace_id,propertyId:row.property_id??undefined,
      amount:Money.fromMinorUnits(Number(row.amount_minor),row.currency),category:row.account_id,measurement:row.measurement,
      effectiveDate:row.effective_date,postingDate:row.posting_date??undefined,
      source:{provider:row.source_provider,externalId:row.source_external_id??undefined},status:row.status,evidenceIds:Object.freeze(row.evidence_ids??[]),
    }));
    return Object.freeze([...revenue,...observations]);
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
      propertyId: String(row.id), label: String(row.name), included: configuration.get(row.id) !== "excluded",
      reportingEligible: row.status !== "archived",
      market: [row.city, row.state].filter(Boolean).join(", ") || undefined,
      operatingModel: row.property_type || undefined,
    })));
  }
}
