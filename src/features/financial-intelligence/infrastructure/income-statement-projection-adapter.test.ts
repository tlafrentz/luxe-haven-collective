import { describe, expect, it, vi } from "vitest";
import { permissionsForRole, type WorkspaceAccessContext } from "@/features/workspace";
import { Money } from "@/platform/kernel";
import { FinancialTransaction, type FinancialAccount } from "../domain";
import { IncomeStatementProjectionAdapter } from ".";

const account: FinancialAccount = { id: "revenue", workspaceId: "w", code: "4000", name: "Revenue", category: "revenue", subcategory: "Accommodation", active: true };
const source = () => ({ getIdentity: vi.fn(async () => ({ workspaceId:"w",organizationId:"o",reportingCurrency:"USD",fiscalYearStartMonth:1,timezone:"UTC",reportingStandards:["GAAP"],accountingMethod:"accrual" as const })), listAccounts: vi.fn(async()=>[account]), listTransactions: vi.fn(async(scope:{propertyIds?:readonly string[]}) => (scope.propertyIds??[]).map(propertyId => FinancialTransaction.create({id:`tx:${propertyId}`,accountId:"revenue",workspaceId:"w",propertyId,amount:Money.usd(100),category:"accommodation",measurement:"measured",effectiveDate:"2026-07-01",postingDate:"2026-07-01",source:{provider:"ledger"},status:"posted",evidenceIds:["e"]}))), getSynchronization:vi.fn(async()=>({lastSuccessfulAt:"2026-07-25T00:00:00Z",expectedProviders:1,connectedProviders:1,historyMonths:12})) });
const catalog = { list: vi.fn(async()=>[{propertyId:"one",label:"One",included:true,reportingEligible:true,market:"Austin",operatingModel:"owned"},{propertyId:"two",label:"Two",included:true,reportingEligible:true,market:"Dallas",operatingModel:"managed"}]) };
function access(role:"owner"|"operator", ids:readonly string[]=[]):WorkspaceAccessContext{return{profileId:"p",workspaceId:"w",ownerId:"w",ownerProfileId:"p",membershipId:"m",role,status:"active",propertyAccess:role==="owner"?{type:"all"}:{type:"selected",propertyIds:ids},permissions:permissionsForRole(role)}}
const query={workspaceId:"w",period:{kind:"month" as const,from:"2026-07-01",to:"2026-07-31",reportingCalendar:"calendar" as const},comparisonType:"none" as const,evaluatedAt:"2026-07-25T12:00:00Z"};
describe("Income Statement projection adapter",()=>{
  it("authorizes included properties before aggregation and limits operator details",async()=>{const gateway=source();const result=await new IncomeStatementProjectionAdapter(access("operator",["two"]),gateway,catalog).read(query);expect(result.scope.propertyIds).toEqual(["two"]);expect(result.canViewRevenueDetail).toBe(false);expect(result.canViewExpenseDetail).toBe(false);expect(gateway.listTransactions).toHaveBeenCalledWith(expect.objectContaining({propertyIds:["two"]}));});
  it("allows owner category detail",async()=>{const result=await new IncomeStatementProjectionAdapter(access("owner"),source(),catalog).read(query);expect(result.canViewRevenueDetail).toBe(true);expect(result.canViewExpenseDetail).toBe(true);});
  it("denies inaccessible properties before financial reads",async()=>{const gateway=source();await expect(new IncomeStatementProjectionAdapter(access("operator",["one"]),gateway,catalog).read({...query,propertyIds:["two"]})).rejects.toMatchObject({code:"permission"});expect(gateway.getIdentity).not.toHaveBeenCalled();});
});
