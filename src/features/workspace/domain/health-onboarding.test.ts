import { describe,expect,it } from "vitest";
import { buildWorkspaceHealth,type WorkspaceReadinessInput } from "./health-onboarding";
const ready:WorkspaceReadinessInput={workspaceId:"w",role:"owner",identityValid:true,activeOwnerCount:1,organizationRequiredComplete:true,organizationConfirmed:true,includedProperties:1,invalidPropertyOwnership:false,propertySetupIssues:0,connectionRequired:true,connectionStatus:"connected",firstSyncComplete:true,operationalQuality:"trusted",operationalSync:"succeeded",criticalNotificationsAvailable:true,notificationsConfirmed:true,preferencesValid:true};
describe("workspace readiness",()=>{
 it("separates ready setup from degraded operations",()=>{expect(buildWorkspaceHealth(ready).status).toBe("ready");const health=buildWorkspaceHealth({...ready,operationalSync:"failed"});expect(health.setup).toBe("healthy");expect(health.operations).toBe("degraded");expect(health.status).toBe("degraded");});
 it("applies blocked precedence",()=>expect(buildWorkspaceHealth({...ready,identityValid:false,operationalSync:"failed"}).status).toBe("blocked"));
 it("does not make solo teams or no invitations unhealthy",()=>expect(buildWorkspaceHealth(ready).issues).toHaveLength(0));
 it("keeps recommendations outside required progress",()=>{const health=buildWorkspaceHealth({...ready,notificationsConfirmed:false});expect(health.onboarding.requiredCompleted).toBe(health.onboarding.requiredTotal);expect(health.onboarding.recommendedCompleted).toBe(0);});
 it("filters administrative actions for scoped members",()=>{const health=buildWorkspaceHealth({...ready,role:"operator",includedProperties:0});expect(health.issues[0]?.action).toBeUndefined();expect(health.onboarding.tasks.some((task)=>task.administratorOnly)).toBe(false);});
 it("reopens completed onboarding after regression",()=>expect(buildWorkspaceHealth({...ready,connectionStatus:"authorization-expired",onboardingCompletedAt:"2026-07-25T00:00:00Z"}).onboarding.status).toBe("needs-attention"));
});
