import type { ReportDefinition,ReportScopeType,ReportType } from "./model";

export type ReportSectionDefinition=Readonly<{key:string;title:string;kind:"common"|"capability";description:string}>;
export const commonReportSections=Object.freeze([
  section("executive-summary","Executive Summary","common"),section("evidence","Supporting Evidence","common"),
  section("methodology","Methodology","common"),section("recommendations","Recommendations","common"),
  section("actions","Recommended Actions","common"),section("risks","Key Risks","common"),
  section("data-quality","Data Quality","common"),section("appendix","Appendix","common"),
]);
export const capabilityReportSections=Object.freeze([
  section("scenario-analysis","Scenario Analysis","capability"),section("comparable-properties","Comparable Properties","capability"),
  section("booking-trends","Booking Trends","capability"),section("guest-satisfaction","Guest Satisfaction","capability"),
  section("property-contribution","Property Contribution","capability"),section("portfolio-health","Portfolio Health","capability"),
  section("cash-flow","Cash Flow","capability"),section("liquidity","Liquidity","capability"),section("capital-allocation","Capital Allocation","capability"),
]);
export const reportSectionLibrary=Object.freeze([...commonReportSections,...capabilityReportSections]);

const registrations:readonly ReportDefinition[]=[
  define("investment-decision",["investment-scenario"],false,"investment.reports.generate","investment-report-projection.v1",["decision-summary","property-profile","market-intelligence","financial-performance","risk-analysis","investment-score","recommendation","evidence-methodology"],["Investor","Owner","Partner","Advisor"],"allowed"),
  define("property-performance",["property"],true,"reports.generate","property-report-projection.v1",["performance-summary","revenue-metrics","booking-trends","operational-attention","evidence-methodology"],["Owner","Property Manager"],"workspace-policy"),
  define("portfolio-performance",["portfolio","workspace"],true,"portfolio.reports.generate","portfolio-report-projection.v1",["portfolio-condition","primary-metrics","property-contribution","risks-opportunities","evidence-methodology"],["Owner","Executive"],"workspace-policy"),
  define("financial-performance",["financial-scope"],true,"financial.reports.generate","financial-report-projection.v1",["financial-condition","income-statement","cash-flow","liquidity","budget-forecast","evidence-methodology"],["Owner","CPA","Lender"],"disabled"),
];
export const canonicalReportRegistry=Object.freeze({
  definitions:Object.freeze(registrations),
  get(type:ReportType){return registrations.find(item=>item.key===type)??null;},
  active(){return registrations.filter(item=>item.status==="active");},
});
function section(key:string,title:string,kind:ReportSectionDefinition["kind"]):ReportSectionDefinition{return Object.freeze({key,title,kind,description:`Reusable ${title.toLowerCase()} report section.`});}
function define(key:ReportType,scopes:readonly ReportScopeType[],periods:boolean,entitlement:string,projection:string,required:readonly string[],audiences:readonly string[],sharing:ReportDefinition["externalSharing"]):ReportDefinition{
  const names={"investment-decision":"Investment Decision Report","property-performance":"Property Performance Report","portfolio-performance":"Portfolio Performance Report","financial-performance":"Financial Performance Report"};
  return Object.freeze({id:`report-definition-${key}`,key,name:names[key],description:`Canonical ${names[key].toLowerCase()}.`,supportedScopes:Object.freeze(scopes),supportsPeriods:periods,requiredEntitlementKey:entitlement,requiredProjectionKey:projection,defaultTemplateId:`report-template-${key}-v1`,requiredSections:Object.freeze(required),optionalSections:Object.freeze(["actions","notes"]),audiences:Object.freeze(audiences),externalSharing:sharing,status:"active"});
}
