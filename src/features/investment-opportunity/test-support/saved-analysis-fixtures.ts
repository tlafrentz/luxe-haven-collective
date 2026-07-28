import { createPurchaseLifecycleResult,createRentalLifecycleResult } from "@/features/investment-intelligence/application/__tests__/fixtures/investment-lifecycle.fixture";
import { permissionsForRole,type WorkspaceAccessContext,type WorkspaceRole } from "@/features/workspace";
import { buildOpportunityAnalysisSnapshot,type InvestmentOpportunitySaveResult } from "../application";
import {
  OpportunityNoteBody,
  createInvestmentOpportunityId,
  createOpportunityActivityId,
  createOpportunityNoteId,
  type OpportunityActivity,
  type OpportunityAnalysisSnapshot,
  type OpportunityNote,
} from "../domain";

export const savedAnalysisFixtureClock=new Date("2026-07-27T12:00:00.000Z");
export const savedAnalysisFixtureIds=Object.freeze({
  workspace:"workspace-fixture",otherWorkspace:"workspace-other",owner:"profile-owner",administrator:"profile-admin",
  member:"profile-member",viewer:"profile-viewer",restricted:"profile-restricted",otherUser:"profile-other",
  property:"property-fixture",otherProperty:"property-other",opportunity:"investment-opportunity-fixture",
  analysisV1:"opportunity-analysis-fixture-v1",analysisV2:"opportunity-analysis-fixture-v2",
  scenario:"scenario-fixture",report:"report-fixture",note:"opportunity-note-fixture",activity:"opportunity-activity-fixture",
});

export function buildWorkspaceAccessFixture(role:WorkspaceRole,overrides:Partial<WorkspaceAccessContext>={}):WorkspaceAccessContext{
  const profileId=role==="owner"?savedAnalysisFixtureIds.owner:role==="administrator"?savedAnalysisFixtureIds.administrator:role==="viewer"?savedAnalysisFixtureIds.viewer:savedAnalysisFixtureIds.member;
  return{profileId,workspaceId:savedAnalysisFixtureIds.workspace,ownerId:savedAnalysisFixtureIds.workspace,ownerProfileId:savedAnalysisFixtureIds.owner,membershipId:`membership-${profileId}`,role,status:"active",propertyAccess:role==="owner"?{type:"all"}:{type:"selected",propertyIds:[savedAnalysisFixtureIds.property]},permissions:permissionsForRole(role),...overrides};
}
export const buildSubjectPropertyFixture=()=>Object.freeze({marketPropertyId:savedAnalysisFixtureIds.property,normalizedAddress:{address1:"100 Fixture Lane",city:"Austin",state:"TX",postalCode:"78701"},displayAddress:"100 Fixture Lane, Austin, TX 78701",propertyType:"apartment",bedrooms:2,bathrooms:2,squareFeet:1000,resolutionStatus:"resolved" as const,capturedAt:savedAnalysisFixtureClock});

const purchaseAssumptions=[
  ["purchase-price",425000,"user","currency","once"],["closing-costs",12000,"user","currency","once"],["furnishing-budget",25000,"user","currency","once"],
  ["down-payment-percentage",25,"user","percentage",undefined],["interest-rate-percentage",6.5,"user","percentage",undefined],["loan-term-years",30,"user","count","term"],
  ["projected-adr",235,"market","currency","nightly"],["projected-occupancy-percentage",68,"market","percentage",undefined],["average-length-of-stay",4,"user","count",undefined],
  ["management-fee-percentage",10,"user","percentage",undefined],["monthly-utilities",300,"user","currency","monthly"],["annual-insurance-premium",2400,"user","currency","annual"],
  ["annual-property-taxes",4200,"user","currency","annual"],["annual-cleaning",7200,"user","currency","annual"],["annual-software",1200,"user","currency","annual"],
  ["annual-supplies",1800,"user","currency","annual"],["maintenance-reserve-percentage",5,"system-default","percentage",undefined],["capital-reserve-percentage",3,"system-default","percentage",undefined],
] as const;
const rentalAssumptions=[
  ["monthly-lease",2400,"user","currency","monthly"],["security-deposit",2400,"user","currency","once"],["lease-term-months",12,"user","count","term"],
  ["startup-costs",5000,"user","currency","once"],["utilities-included",false,"user","boolean",undefined],
  ...purchaseAssumptions.filter(([key])=>!["purchase-price","closing-costs","down-payment-percentage","interest-rate-percentage","loan-term-years","annual-property-taxes"].includes(key)),
] as const;

export function buildSavedPurchaseAnalysis(overrides:Partial<OpportunityAnalysisSnapshot>={}):OpportunityAnalysisSnapshot{
  const base=buildOpportunityAnalysisSnapshot(createPurchaseLifecycleResult(),savedAnalysisFixtureClock);
  return structuredClone({...base,assumptions:purchaseAssumptions.map(([key,value,source,unit,period])=>({key,value,source,unit,currency:unit==="currency"?"USD" as const:undefined,period,mode:unit==="percentage"?"percentage" as const:"fixed" as const,explicitlyOverridden:source==="user",sourceTimestamp:savedAnalysisFixtureClock.toISOString()})),...overrides});
}
export function buildSavedRentalAnalysis(overrides:Partial<OpportunityAnalysisSnapshot>={}):OpportunityAnalysisSnapshot{
  const base=buildOpportunityAnalysisSnapshot(createRentalLifecycleResult(),savedAnalysisFixtureClock);
  return structuredClone({...base,assumptions:rentalAssumptions.map(([key,value,source,unit,period])=>({key,value,source,unit,currency:unit==="currency"?"USD" as const:undefined,period,mode:unit==="percentage"?"percentage" as const:"fixed" as const,explicitlyOverridden:source==="user",sourceTimestamp:savedAnalysisFixtureClock.toISOString()})),...overrides});
}
export const buildScenarioFixture=(overrides:Record<string,unknown>={})=>Object.freeze({scenarioId:savedAnalysisFixtureIds.scenario,opportunityId:savedAnalysisFixtureIds.opportunity,sourceAnalysisVersionId:savedAnalysisFixtureIds.analysisV1,assumptionsSnapshot:{},outputSnapshot:buildSavedPurchaseAnalysis(),createdAt:savedAnalysisFixtureClock.toISOString(),createdBy:savedAnalysisFixtureIds.owner,...overrides});
export const buildReportFixture=(overrides:Record<string,unknown>={})=>Object.freeze({id:savedAnalysisFixtureIds.report,opportunityId:savedAnalysisFixtureIds.opportunity,analysisVersionId:savedAnalysisFixtureIds.analysisV1,templateVersion:"investment-report-v1",renderingVersion:"report-projection-v1",generatedAt:savedAnalysisFixtureClock.toISOString(),generatedBy:savedAnalysisFixtureIds.owner,...overrides});
export const buildReceiptFixture=(overrides:Partial<InvestmentOpportunitySaveResult>={}):InvestmentOpportunitySaveResult=>Object.freeze({opportunityId:savedAnalysisFixtureIds.opportunity,analysisVersionId:savedAnalysisFixtureIds.analysisV1,analysisVersionNumber:1,aggregateVersion:2,idempotent:false,...overrides});
export const buildNoteFixture=(overrides:Partial<OpportunityNote>={}):OpportunityNote=>Object.freeze({id:createOpportunityNoteId(savedAnalysisFixtureIds.note),opportunityId:createInvestmentOpportunityId(savedAnalysisFixtureIds.opportunity),body:OpportunityNoteBody.create("Fixture underwriting note."),author:{type:"user" as const,id:savedAnalysisFixtureIds.owner},createdAt:savedAnalysisFixtureClock,...overrides});
export const buildActivityFixture=(overrides:Partial<OpportunityActivity>={}):OpportunityActivity=>Object.freeze({id:createOpportunityActivityId(savedAnalysisFixtureIds.activity),opportunityId:createInvestmentOpportunityId(savedAnalysisFixtureIds.opportunity),type:"analysis-saved",actor:{type:"user" as const,id:savedAnalysisFixtureIds.owner},details:{analysisId:savedAnalysisFixtureIds.analysisV1,sequence:1},occurredAt:savedAnalysisFixtureClock,aggregateVersion:2,...overrides});
