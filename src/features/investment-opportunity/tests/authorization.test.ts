import {describe,expect,it} from "vitest";
import {permissionsForRole,type WorkspaceAccessContext,type WorkspaceRole} from "@/features/workspace";
import {evaluateInvestmentAuthorization,requireInvestmentAuthorization} from "../application";

function access(role:WorkspaceRole,input:Partial<Pick<WorkspaceAccessContext,"workspaceId"|"status"|"propertyAccess">>={}):WorkspaceAccessContext{
  return{profileId:"profile-1",workspaceId:input.workspaceId??"workspace-1",ownerId:"workspace-1",ownerProfileId:"owner-1",membershipId:"membership-1",role,status:input.status??"active",propertyAccess:input.propertyAccess??(role==="owner"?{type:"all"}:{type:"selected",propertyIds:["property-1"]}),permissions:permissionsForRole(role)};
}
const resource={workspaceId:"workspace-1",propertyId:"property-1",opportunityId:"opportunity-1"} as const;

describe("SA-001F Investment authorization policy",()=>{
  it.each(["owner","administrator","operator","contributor"] as const)("%s may manage an authorized property",role=>{
    expect(evaluateInvestmentAuthorization(access(role),"analysis.create",resource).allowed).toBe(true);
    expect(evaluateInvestmentAuthorization(access(role),"scenario.create",resource).allowed).toBe(true);
  });
  it("allows a viewer to read but not mutate or generate",()=>{
    expect(evaluateInvestmentAuthorization(access("viewer"),"analysis.read",resource).allowed).toBe(true);
    expect(evaluateInvestmentAuthorization(access("viewer"),"note.create",resource).reason).toBe("permission-denied");
    expect(evaluateInvestmentAuthorization(access("viewer"),"report.generate",resource).reason).toBe("permission-denied");
  });
  it("enforces selected, none, and cross-workspace scopes without revealing existence",()=>{
    expect(evaluateInvestmentAuthorization(access("operator"),"analysis.read",resource).allowed).toBe(true);
    expect(evaluateInvestmentAuthorization(access("operator"),"analysis.read",{...resource,propertyId:"property-2"}).reason).toBe("property-denied");
    expect(evaluateInvestmentAuthorization(access("operator",{propertyAccess:{type:"none"}}),"analysis.read",resource).allowed).toBe(false);
    expect(evaluateInvestmentAuthorization(access("owner",{workspaceId:"workspace-2"}),"analysis.read",resource).reason).toBe("workspace-mismatch");
    expect(()=>requireInvestmentAuthorization(access("operator"),"analysis.read",{...resource,propertyId:"property-2"})).toThrow("not found");
  });
  it("denies suspended members and blocks archived mutations before work begins",()=>{
    expect(evaluateInvestmentAuthorization(access("administrator",{status:"suspended"}),"analysis.read",resource).reason).toBe("inactive-membership");
    expect(evaluateInvestmentAuthorization(access("owner"),"analysis.reanalyze",{...resource,archived:true}).reason).toBe("archived");
    expect(evaluateInvestmentAuthorization(access("owner"),"analysis.read",{...resource,archived:true}).allowed).toBe(true);
    expect(evaluateInvestmentAuthorization(access("owner"),"report.generate",{...resource,archived:true}).allowed).toBe(true);
  });
  it("allows only elevated roles to manage unlinked opportunities, matching RLS",()=>{
    expect(evaluateInvestmentAuthorization(access("owner"),"opportunity.modify",{workspaceId:"workspace-1"}).allowed).toBe(true);
    expect(evaluateInvestmentAuthorization(access("operator"),"opportunity.modify",{workspaceId:"workspace-1"}).reason).toBe("property-denied");
  });
});
