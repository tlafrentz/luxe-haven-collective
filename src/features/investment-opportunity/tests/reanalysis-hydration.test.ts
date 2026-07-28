import { describe, expect, it } from "vitest";
import { createPurchaseLifecycleResult } from "@/features/investment-intelligence/application/__tests__/fixtures/investment-lifecycle.fixture";
import {
  applyReanalysisRefresh,
  buildOpportunityAnalysisSnapshot,
  buildReanalysisChangeSet,
  createInvestmentOpportunity,
  hydrateReanalysis,
  readImmutableAnalysis,
  saveOpportunityAnalysis,
  shouldCreateReanalysisVersion,
} from "../application";
import { InMemoryInvestmentOpportunityRepository } from "../infrastructure";

const ownerId="workspace-1",actor={type:"user" as const,id:"operator-1"},at=new Date("2026-07-27T12:00:00Z");
const sourceSummary={userSuppliedCount:2,learningSuppliedCount:0,marketSuppliedCount:1,defaultSuppliedCount:1,overrides:[],marketEvidenceAvailable:true} as const;
async function source() {
  const repository=new InMemoryInvestmentOpportunityRepository(),result=createPurchaseLifecycleResult(),subject=result.analysis.property,property={marketPropertyId:subject.id,normalizedAddress:{address1:subject.location.address1,city:subject.location.city,state:subject.location.state,postalCode:subject.location.postalCode},displayAddress:`${subject.location.address1}, ${subject.location.city}`,propertyType:"apartment",bedrooms:subject.bedrooms,bathrooms:subject.bathrooms,squareFeet:subject.squareFeet,resolutionStatus:"resolved" as const,capturedAt:at};
  const opportunity=await createInvestmentOpportunity(repository,{authenticatedOwnerId:ownerId,actor,route:"purchase",property,occurredAt:at});
  const base=buildOpportunityAnalysisSnapshot(result,at),snapshot={...base,assumptions:[
    {key:"purchase-price",value:0,source:"user",unit:"currency" as const,currency:"USD" as const,period:"once" as const,mode:"fixed" as const,explicitlyOverridden:true,overriddenValue:425000,overriddenSource:"market"},
    {key:"projected-adr",value:215,source:"market",unit:"currency" as const,currency:"USD" as const,period:"nightly" as const},
    {key:"annual-insurance-premium",value:null,source:"system-default",unit:"currency" as const,currency:"USD" as const,period:"annual" as const},
    {key:"maintenance-reserve-percentage",value:5,source:"system-default",unit:"percentage" as const,mode:"percentage" as const},
  ]};
  const saved=await saveOpportunityAnalysis(repository,{authenticatedOwnerId:ownerId,actor,opportunityId:opportunity.id,expectedVersion:1,analysis:{lifecycleResult:result,lifecycleResultId:"run-1",sourceSummary,snapshot,policyVersions:{investmentAnalysisPolicy:"calc-v1",investmentRecommendationPolicy:"score-v1"},analyzedAt:at}});
  const projection=await readImmutableAnalysis(repository,{ownerId,opportunityId:saved.id.value,analysisVersionId:saved.props.analyses[0].id.value});
  return {repository,saved,projection:projection!};
}

describe("SA-001D reanalysis hydration",()=>{
  it("restores zero, null, units, periods, provenance, and override identity losslessly",async()=>{
    const{projection}=await source(),state=hydrateReanalysis(projection,{workspaceId:ownerId,currentProviderObservations:{"projected-adr":228},currentPlatformDefaults:{"maintenance-reserve-percentage":7},staleKeys:["projected-adr"]});
    expect(state.workspaceValues.purchasePrice).toBe(0);
    expect(state.assumptions["annual-insurance-premium"].value).toBeNull();
    expect(state.assumptions["purchase-price"]).toMatchObject({provenance:"saved_user_input",explicitlyOverridden:true,overriddenValue:425000,currency:"USD",period:"once"});
    expect(state.assumptions["projected-adr"]).toMatchObject({value:215,currentProviderAlternative:228,refreshEligible:true,stale:true});
    expect(state.assumptions["maintenance-reserve-percentage"]).toMatchObject({value:5,currentDefaultAlternative:7,refreshEligible:false});
  });
  it("never adopts provider evidence until explicitly accepted",async()=>{
    const{projection}=await source(),initial=hydrateReanalysis(projection,{workspaceId:ownerId,currentProviderObservations:{"projected-adr":228}});
    expect(initial.workspaceValues.projectedAdr).toBe(215);
    const accepted=applyReanalysisRefresh(initial,["projected-adr"],[]);
    expect(accepted.workspaceValues.projectedAdr).toBe(228);
    expect(accepted.assumptions["projected-adr"].provenance).toBe("current_provider_observation");
    expect(buildReanalysisChangeSet(accepted,accepted.workspaceValues)).toContainEqual(expect.objectContaining({key:"projected-adr",before:215,after:228}));
  });
  it("hydrates without a provider and deterministically avoids no-change versions",async()=>{
    const{projection}=await source(),state=hydrateReanalysis(projection,{workspaceId:ownerId});
    expect(state.evidenceRefreshStatus).toBe("not-requested");
    expect(shouldCreateReanalysisVersion(buildReanalysisChangeSet(state,state.workspaceValues,{calculation:"calc-v1",scoring:"score-v1"}))).toBe(false);
    expect(shouldCreateReanalysisVersion(buildReanalysisChangeSet(state,state.workspaceValues,{calculation:"calc-v2",scoring:"score-v1"}))).toBe(true);
  });
  it("creates a sequential branch from an explicitly selected historical version without mutating it",async()=>{
    const{repository,saved,projection}=await source(),result=createPurchaseLifecycleResult(),first=structuredClone(projection.snapshot);
    const v2=await saveOpportunityAnalysis(repository,{authenticatedOwnerId:ownerId,actor,opportunityId:saved.id,expectedVersion:2,analysis:{lifecycleResult:result,lifecycleResultId:"run-2",sourceSummary,sourceAnalysisVersionId:projection.analysisVersion.id,analyzedAt:new Date(at.getTime()+1)}});
    const v3=await saveOpportunityAnalysis(repository,{authenticatedOwnerId:ownerId,actor,opportunityId:v2.id,expectedVersion:3,analysis:{lifecycleResult:result,lifecycleResultId:"run-3",sourceSummary,sourceAnalysisVersionId:projection.analysisVersion.id,analyzedAt:new Date(at.getTime()+2)}});
    expect(v3.props.analyses.map(value=>value.sequence)).toEqual([1,2,3]);
    expect(v3.props.analyses[2].props.lineage.sourceAnalysisVersionId).toBe(projection.analysisVersion.id);
    expect(v3.props.analyses[0].props.resultSnapshot).toEqual(first);
  });
});
