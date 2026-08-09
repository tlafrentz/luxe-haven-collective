import {describe,expect,it} from "vitest";
import {
  buildGuidebookPropertyProjection,
  buildGuidebookWorkspaceProjection,
  filterGuidebookLibrary,
  type GuidebookPropertyInput,
  type GuidebookRecordInput,
  type GuidebookSectionInput,
} from "./domain/guidebook-workspace";

const property:GuidebookPropertyInput={
  id:"property-1",name:"Lakeside House",status:"active",address:"123 Lake Road",
  checkInTime:"16:00",checkoutTime:"10:00",houseRules:["No smoking"],updatedAt:"2026-07-25T12:00:00Z",
};
const guidebook:GuidebookRecordInput={
  id:"guide-1",propertyId:property.id,title:"Lakeside Guest Guide",status:"draft",
  currentVersion:1,publishedVersion:null,publicSlug:"lakeside-house",revision:3,
  createdAt:"2026-07-20T12:00:00Z",updatedAt:"2026-07-25T12:00:00Z",
};
const completeSections:GuidebookSectionInput[]=[
  "welcome","arrival","parking","check-in","wi-fi","house-rules","emergency","checkout",
].map(key=>({key,visible:true,blockCount:1}));
const entitlements={create:true,publish:true,host:true};

describe("Guidebook workspace projection",()=>{
  it("distinguishes entitled empty and unavailable onboarding",()=>{
    const base={workspaceId:"workspace-1",properties:[property],guidebooks:[],sections:{},versions:{},activity:[],permissions:{view:true,manage:true}};
    expect(buildGuidebookWorkspaceProjection({...base,entitlements}).onboarding).toBe("entitled-empty");
    expect(buildGuidebookWorkspaceProjection({...base,entitlements:{create:false,publish:false,host:false}}).onboarding).toBe("not-entitled");
  });

  it("marks a complete draft ready and recommends publishing",()=>{
    const result=buildGuidebookPropertyProjection({property,guidebook,sections:completeSections,versions:[],entitlements});
    expect(result.status).toBe("ready");
    expect(result.health.status).toBe("ready");
    expect(result.suggestedActions.map(action=>action.key)).toContain("publish");
  });

  it("makes missing guest information explicit and actionable",()=>{
    const result=buildGuidebookPropertyProjection({
      property,guidebook,sections:completeSections.filter(section=>section.key!=="wi-fi"),versions:[],entitlements,
    });
    expect(result.status).toBe("draft");
    expect(result.health.status).toBe("missing-required-information");
    expect(result.requiredSections.missing).toContain("wi-fi");
    expect(result.suggestedActions.find(action=>action.key==="wifi")?.label).toBe("Update Wi-Fi section");
  });

  it("separates missing canonical operations from missing guidebook presentation",()=>{
    const result=buildGuidebookPropertyProjection({
      property:{...property,operationalStatus:"needs-property-information",operationalMissing:["wifi","emergencyContact"]},
      guidebook,sections:completeSections,versions:[],entitlements,
    });
    expect(result.health.recovery).toContain("Property workspace");
    expect(result.suggestedActions.find(action=>action.key==="property-information")?.href).toBe("/dashboard/workspace/properties?property=property-1");
    expect(result.suggestedActions.some(action=>action.key==="publish")).toBe(false);
  });

  it("detects published content that is out of sync with property data",()=>{
    const result=buildGuidebookPropertyProjection({
      property,
      guidebook:{...guidebook,status:"published"},
      sections:completeSections,
      versions:[{version:1,status:"published",publishedAt:"2026-07-24T12:00:00Z",createdAt:"2026-07-24T12:00:00Z"}],
      entitlements,
    });
    expect(result.status).toBe("published");
    expect(result.publicUrl.status).toBe("active");
    expect(result.health.status).toBe("property-information-changed");
    expect(result.suggestedActions.map(action=>action.key)).toContain("republish");
  });

  it("counts a live guidebook with newer draft in both published and draft metrics",()=>{
    const publishedWithDraft={...guidebook,status:"published",updatedAt:"2026-07-26T12:00:00Z"};
    const projection=buildGuidebookWorkspaceProjection({
      workspaceId:"workspace-1",properties:[property],guidebooks:[publishedWithDraft],
      sections:{[guidebook.id]:completeSections},
      versions:{[guidebook.id]:[{version:1,status:"published",publishedAt:"2026-07-24T12:00:00Z",createdAt:"2026-07-24T12:00:00Z"}]},
      activity:[],entitlements,permissions:{view:true,manage:true},
    });
    expect(projection.portfolio.publishedGuidebooks).toBe(1);
    expect(projection.portfolio.draftGuidebooks).toBe(1);
    expect(projection.portfolio.unpublishedProperties).toBe(0);
    expect(filterGuidebookLibrary(projection.library,{status:"draft"})).toHaveLength(1);
    expect(filterGuidebookLibrary(projection.library,{status:"published"})).toHaveLength(1);
  });

  it("identifies a broken public publication without treating it as healthy",()=>{
    const result=buildGuidebookPropertyProjection({
      property,guidebook:{...guidebook,status:"published"},sections:completeSections,versions:[],entitlements,
    });
    expect(result.publicUrl.status).toBe("broken");
    expect(result.health.status).toBe("publishing-failed");
    expect(result.suggestedActions.map(action=>action.key)).toContain("retry");
  });

  it("derives a scheduled badge state from a future target publish date",()=>{
    const result=buildGuidebookPropertyProjection({
      property,guidebook:{...guidebook,targetPublishDate:"2099-01-01"},sections:completeSections,versions:[],entitlements,
    });
    expect(result.status).toBe("ready");
    expect(result.badgeState).toBe("scheduled");
  });
  it("ignores a past target publish date for the scheduled badge state",()=>{
    const result=buildGuidebookPropertyProjection({
      property,guidebook:{...guidebook,targetPublishDate:"2020-01-01"},sections:completeSections,versions:[],entitlements,
    });
    expect(result.badgeState).toBe("ready");
  });
  it("derives approval-review badge states, taking priority over a scheduled date",()=>{
    const withDate={...guidebook,targetPublishDate:"2099-01-01"};
    expect(buildGuidebookPropertyProjection({property,guidebook:withDate,sections:completeSections,versions:[],entitlements,approvalStatus:"pending"}).badgeState).toBe("awaiting-customer-approval");
    expect(buildGuidebookPropertyProjection({property,guidebook:withDate,sections:completeSections,versions:[],entitlements,approvalStatus:"changes_requested"}).badgeState).toBe("changes-requested");
    expect(buildGuidebookPropertyProjection({property,guidebook:withDate,sections:completeSections,versions:[],entitlements,approvalStatus:"approved"}).badgeState).toBe("approved");
  });
  it("leaves published and archived badge states untouched by approval or scheduling data",()=>{
    const published=buildGuidebookPropertyProjection({
      property,guidebook:{...guidebook,status:"published",targetPublishDate:"2099-01-01"},sections:completeSections,versions:[{version:1,status:"published",publishedAt:"2026-07-24T12:00:00Z",createdAt:"2026-07-24T12:00:00Z"}],entitlements,approvalStatus:"approved",
    });
    expect(published.badgeState).toBe("published");
  });
  it("filters and sorts the portfolio library without mutating it",()=>{
    const missing=buildGuidebookPropertyProjection({
      property:{...property,id:"property-2",name:"Alpine Cabin"},sections:[],versions:[],entitlements,
    });
    const ready=buildGuidebookPropertyProjection({property,guidebook,sections:completeSections,versions:[],entitlements});
    const library=Object.freeze([ready,missing]);
    expect(filterGuidebookLibrary(library,{status:"missing"}).map(item=>item.property.name)).toEqual(["Alpine Cabin"]);
    expect(filterGuidebookLibrary(library,{query:"lake"}).map(item=>item.property.name)).toEqual(["Lakeside House"]);
    expect(library).toEqual([ready,missing]);
  });
});
