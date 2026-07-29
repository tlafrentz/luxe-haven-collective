import{describe,expect,it}from"vitest";
import{permissionsForRole,type WorkspaceAccessContext}from"@/features/workspace";
import{Money}from"@/platform/kernel";
import{FinancialTransaction,type FinancialAccount,type FinancialIdentity,type FinancialPeriod}from"../domain";
import{aggregatePortfolioFinancialSnapshots,buildFinancialReadModel,deriveFinancialSnapshotLessons,toExecutiveFinancialHealth,toInvestmentActualPerformance,toRevenueFinancialProjection,type FinancialSource}from".";
const period:FinancialPeriod={kind:"month",from:"2026-06-01",to:"2026-06-30",reportingCalendar:"calendar"};
const access:WorkspaceAccessContext={profileId:"p",workspaceId:"w",ownerId:"w",ownerProfileId:"p",membershipId:"m",role:"owner",status:"active",propertyAccess:{type:"all"},permissions:permissionsForRole("owner")};
const identity:FinancialIdentity={workspaceId:"w",organizationId:"w",reportingCurrency:"USD",fiscalYearStartMonth:1,timezone:"America/Chicago",reportingStandards:["management-reporting"],accountingMethod:"accrual"};
const accounts:FinancialAccount[]=[{id:"r",workspaceId:"w",code:"4000",name:"Revenue",category:"revenue",active:true},{id:"e",workspaceId:"w",code:"6000",name:"Cleaning",category:"operating-expense",subcategory:"cleaning",active:true}];
function source(propertyId:string):FinancialSource{return{getIdentity:async()=>identity,listAccounts:async()=>accounts,listTransactions:async()=>[FinancialTransaction.create({id:`r-${propertyId}`,accountId:"r",workspaceId:"w",propertyId,amount:Money.usd(1000),category:"revenue",measurement:"measured",effectiveDate:"2026-06-10",postingDate:"2026-06-10",source:{provider:"bookings"},status:"posted",evidenceIds:[`booking-${propertyId}`]}),FinancialTransaction.create({id:`e-${propertyId}`,accountId:"e",workspaceId:"w",propertyId,amount:Money.usd(400),category:"cleaning",measurement:"measured",effectiveDate:"2026-06-10",postingDate:"2026-06-10",source:{provider:"invoice"},status:"posted",evidenceIds:[`invoice-${propertyId}`]})],getSynchronization:async()=>({lastSuccessfulAt:"2026-06-30T00:00:00Z",expectedProviders:1,connectedProviders:1,historyMonths:12})}}
describe("canonical Financial Snapshot consumers",()=>{it("projects one financial truth to revenue, investment, and executive capabilities",async()=>{const snapshot=(await buildFinancialReadModel(source("one"),{access,workspaceId:"w",propertyId:"one",period,evaluatedAt:"2026-06-30T01:00:00Z"})).snapshot;expect(toRevenueFinancialProjection(snapshot).snapshotId).toBe(snapshot.id);expect(toInvestmentActualPerformance(snapshot).noi!.amount).toBe(600);expect(toExecutiveFinancialHealth(snapshot).snapshotId).toBe(snapshot.id)});it("aggregates portfolio values without recalculating property financials",async()=>{const snapshots=await Promise.all(["one","two"].map(async propertyId=>(await buildFinancialReadModel(source(propertyId),{access,workspaceId:"w",propertyId,period,evaluatedAt:"2026-06-30T01:00:00Z"})).snapshot));const portfolio=aggregatePortfolioFinancialSnapshots(snapshots);expect(portfolio.noi.amount).toBe(1200);expect(portfolio.expenseRatio).toBe(.4);expect(portfolio.snapshotIds).toHaveLength(2)})});

it("derives learning from immutable actual and forecast snapshot lineage",async()=>{
  const base=source("one"),transactions=await base.listTransactions({workspaceId:"w",propertyId:"one",period});
  const withForecast:FinancialSource={...base,listTransactions:async()=>[...transactions,
    FinancialTransaction.create({...transactions[0]!.props,id:"forecast-revenue",amount:Money.usd(900),measurement:"forecast"}),
    FinancialTransaction.create({...transactions[1]!.props,id:"forecast-expense",amount:Money.usd(450),measurement:"forecast"}),
  ]};
  const actual=(await buildFinancialReadModel(withForecast,{access,workspaceId:"w",propertyId:"one",period,basis:"actual",evaluatedAt:"2026-06-30T01:00:00Z"})).snapshot;
  const forecast=(await buildFinancialReadModel(withForecast,{access,workspaceId:"w",propertyId:"one",period,basis:"forecast",evaluatedAt:"2026-06-30T01:00:00Z"})).snapshot;
  const lessons=deriveFinancialSnapshotLessons(actual,forecast);
  expect(lessons[0]).toMatchObject({actualSnapshotId:actual.id,baselineSnapshotId:forecast.id,basis:"forecast"});
});
