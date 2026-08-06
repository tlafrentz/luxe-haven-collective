import {describe,expect,it} from "vitest";
import {assertPublishedVersionImmutable,assertWorkspaceScope,authorizeGuidebook,type GuidebookCommandContext} from "./application/canonical-guidebook-service";
import type {CanonicalGuidebookVersion} from "./domain/canonical-guidebook";
const context:GuidebookCommandContext={workspaceId:"workspace-1",actorId:"actor-1",permissions:new Set(["guidebooks.edit"]),propertyIds:new Set(["property-1"])};
describe("canonical guidebook authorization",()=>{
 it("enforces permission, workspace, and assigned property scope",()=>{expect(()=>authorizeGuidebook(context,"guidebooks.edit","property-1")).not.toThrow();expect(()=>authorizeGuidebook(context,"guidebooks.publish","property-1")).toThrow("GUIDEBOOK_PERMISSION_DENIED");expect(()=>authorizeGuidebook(context,"guidebooks.edit","property-2")).toThrow("GUIDEBOOK_PROPERTY_SCOPE_DENIED");expect(()=>assertWorkspaceScope(context,{workspaceId:"workspace-2"})).toThrow("GUIDEBOOK_WORKSPACE_SCOPE_DENIED")});
 it("rejects edits to durable versions",()=>{expect(()=>assertPublishedVersionImmutable({lifecycleStatus:"published"} as CanonicalGuidebookVersion)).toThrow("GUIDEBOOK_VERSION_IMMUTABLE")});
});
