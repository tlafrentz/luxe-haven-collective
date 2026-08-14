import { describe, expect, it } from "vitest";
import { autosaveDelay, builderComponentIsEligible, compatibleComponents, guidebookHealth } from "./domain";
import type { GuidebookDraft } from "@/features/guidebook-studio";

const draft:GuidebookDraft={guidebookId:"g",workspaceId:"w",propertyId:"p",schemaVersion:"guidebook-draft.v1",revision:1,title:"Mesa",description:"",persistedAt:"",persistedBy:"a",sections:[{id:"s",name:"Welcome",visible:true,position:0,blocks:[]}]};
describe("guidebook builder",()=>{
  it("filters production components by section compatibility",()=>{
    expect(compatibleComponents("Departure").some(c=>c.key==="departure_checklist")).toBe(true);
    expect(compatibleComponents("Departure").some(c=>c.key==="emergency_contact_card")).toBe(false);
  });
  it("offers the required Mesa authoring subset",()=>{
    expect(compatibleComponents("Welcome").map(item=>item.key)).toEqual(expect.arrayContaining(["hero","rich_text","property_summary","image","gallery"]));
    expect(compatibleComponents("Things To Do").map(item=>item.key)).toContain("recommendation_collection");
  });
  it("excludes components without a complete approved renderer contract",()=>{
    expect(builderComponentIsEligible("hero")).toBe(true);
    expect(builderComponentIsEligible("contract_unavailable")).toBe(false);
    expect(compatibleComponents("Welcome").every(item=>builderComponentIsEligible(item.key))).toBe(true);
  });
  it("blocks publishing when required health checks fail",()=>{const health=guidebookHealth(draft);expect(health.publishable).toBe(false);expect(health.issues.some(i=>i.code==="missing_wifi")).toBe(true)});
  it("autosaves dirty changes after a short debounce",()=>expect(autosaveDelay(true)).toBe(650));
});
