import type { WorkspaceRole } from "./team-access";

export type WorkspaceHealthStatus = "ready" | "attention-needed" | "setup-required" | "degraded" | "blocked";
export type WorkspaceDimensionStatus = "healthy" | "attention-needed" | "incomplete" | "degraded" | "blocked" | "not-applicable";
export type WorkspaceHealthDimension = "identity" | "organization" | "team-access" | "properties" | "connected-systems" | "operational-data" | "notifications" | "personal-preferences";
export type WorkspaceIssueSeverity = "critical" | "action-required" | "recommended" | "informational";
export type CapabilityAvailability = "available" | "available-with-limitations" | "unavailable" | "not-configured" | "not-authorized";
export type ReadinessRequirement = "required" | "recommended" | "optional";

export type WorkspaceHealthAction = Readonly<{ type: "configure"|"review"|"reconnect"|"retry"|"resolve-conflict"|"invite"|"verify"|"contact-support"; label: string; href: string; administratorOnly?: boolean }>;
export type WorkspaceHealthIssue = Readonly<{
  id: string; code: string; dimension: WorkspaceHealthDimension; severity: WorkspaceIssueSeverity;
  title: string; description: string; impact: string; affectedCapabilities: readonly string[];
  action?: WorkspaceHealthAction; dismissible: boolean;
}>;
export type WorkspaceCapabilityHealth = Readonly<{ id: string; label: string; availability: CapabilityAvailability; explanation: string }>;
export type WorkspaceHealthDimensionSummary = Readonly<{ dimension: WorkspaceHealthDimension; status: WorkspaceDimensionStatus; label: string }>;
export type OnboardingTask = Readonly<{ code: string; label: string; requirement: ReadinessRequirement; complete: boolean; source: "system-evaluated"|"user-confirmed"|"administrator-verified"; href?: string; administratorOnly?: boolean }>;
export type WorkspaceOnboarding = Readonly<{ status: "not-started"|"in-progress"|"ready-for-review"|"completed"|"needs-attention"; tasks: readonly OnboardingTask[]; requiredCompleted: number; requiredTotal: number; recommendedCompleted: number; recommendedTotal: number; completedAt?: string }>;
export type CanonicalWorkspaceHealth = Readonly<{
  workspaceId: string; status: WorkspaceHealthStatus;
  setup: WorkspaceDimensionStatus; operations: WorkspaceDimensionStatus;
  dimensions: readonly WorkspaceHealthDimensionSummary[]; issues: readonly WorkspaceHealthIssue[];
  nextActions: readonly WorkspaceHealthAction[]; capabilities: readonly WorkspaceCapabilityHealth[];
  onboarding: WorkspaceOnboarding; lastEvaluatedAt: string; evaluationVersion: "workspace-readiness-v1";
}>;

export type WorkspaceReadinessInput = Readonly<{
  workspaceId: string; role: WorkspaceRole; identityValid: boolean; activeOwnerCount: number;
  organizationRequiredComplete: boolean; organizationConfirmed: boolean;
  includedProperties: number; invalidPropertyOwnership: boolean; propertySetupIssues: number;
  connectionRequired: boolean; connectionStatus: string; firstSyncComplete: boolean;
  operationalQuality: string; operationalSync: string;
  criticalNotificationsAvailable: boolean; notificationsConfirmed: boolean; preferencesValid: boolean;
  onboardingCompletedAt?: string;
}>;

const order: Record<WorkspaceIssueSeverity, number> = { critical: 0, "action-required": 1, recommended: 2, informational: 3 };
export function buildWorkspaceHealth(input: WorkspaceReadinessInput, now = new Date()): CanonicalWorkspaceHealth {
  const admin = input.role === "owner" || input.role === "administrator";
  const issues: WorkspaceHealthIssue[] = [];
  const add = (issue: WorkspaceHealthIssue) => issues.push(Object.freeze(issue));
  if (!input.identityValid) add(issue("workspace_identity_unresolved","identity","critical","Workspace identity cannot be resolved","The authenticated profile, owner, workspace, or membership chain is invalid.","Core workspace reads and authorization are blocked.",["Workspace"],{ type:"contact-support",label:"Contact support",href:"/contact" },false));
  if (input.activeOwnerCount < 1) add(issue("owner_membership_missing","team-access","critical","Active owner membership is missing","The workspace has no active Owner membership.","Administrative safeguards and ownership cannot be trusted.",["Workspace","Team & Access"],admin ? { type:"review",label:"Review team access",href:"/dashboard/workspace/team",administratorOnly:true }:undefined,false));
  if (!input.organizationRequiredComplete || !input.organizationConfirmed) add(issue("organization_configuration_incomplete","organization","action-required","Organization setup is incomplete","Confirm the business identity and regional defaults.","Reports and product defaults may be unreliable.",["Reports","Guidebooks"],admin ? { type:"configure",label:"Configure Organization",href:"/dashboard/workspace/organization",administratorOnly:true }:undefined,false));
  if (input.invalidPropertyOwnership) add(issue("property_owner_missing","properties","critical","Property ownership is invalid","An active canonical property does not resolve through this workspace.","Property and booking access cannot be evaluated safely.",["Properties","Bookings"],admin ? { type:"contact-support",label:"Review ownership integrity",href:"/dashboard/workspace/properties",administratorOnly:true }:undefined,false));
  else if (!input.includedProperties) add(issue("no_included_properties","properties","action-required","No properties are included","Include or import a canonical property to begin operating.","Bookings and operational products have no active property context.",["Properties","Bookings"],admin ? { type:"configure",label:"Configure properties",href:"/dashboard/workspace/properties",administratorOnly:true }:undefined,false));
  if (input.connectionRequired && ["authorization-expired","disconnected","never-connected"].includes(input.connectionStatus)) add(issue("provider_connection_unavailable","connected-systems","action-required","Operational connection requires attention","The provider connection is unavailable or authorization has expired.","New property and booking updates will not arrive.",["Bookings","Properties"],admin ? { type:"reconnect",label:"Reconnect Hospitable",href:"/dashboard/workspace/connected-systems",administratorOnly:true }:undefined,false));
  if (input.operationalSync === "partially-succeeded") add(issue("provider_sync_partial_failure","operational-data","action-required","Synchronization completed with issues","Some records remain on last-known-good data.","Affected operational context may be incomplete.",["Bookings","Home"],admin ? { type:"retry",label:"Review synchronization",href:"/dashboard/workspace/connected-systems",administratorOnly:true }:undefined,false));
  else if (input.firstSyncComplete && input.operationalSync === "failed") add(issue("provider_sync_stale","operational-data","action-required","Operational data may be stale","The latest synchronization failed; prior successful data remains available.","Recent provider changes may not appear.",["Bookings","Home"],admin ? { type:"retry",label:"Retry synchronization",href:"/dashboard/workspace/connected-systems",administratorOnly:true }:undefined,false));
  if (!input.criticalNotificationsAvailable) add(issue("required_notification_channel_unavailable","notifications","action-required","Critical notification delivery is unavailable","At least one required security delivery path must remain available.","Important access or connection changes may not reach you.",["Notifications","Team & Security"],{ type:"configure",label:"Review notifications",href:"/dashboard/workspace/notifications" },false));
  if (!input.preferencesValid) add(issue("personal_preferences_invalid","personal-preferences","recommended","Personal defaults need review","A saved route, property, timezone, or locale is no longer valid.","Luxe Haven will use safe fallback settings.",["Home"],{ type:"review",label:"Review preferences",href:"/dashboard/workspace/preferences" },true));
  const dimensions: WorkspaceHealthDimensionSummary[] = [
    dim("identity", input.identityValid ? "healthy":"blocked","Workspace Identity"),
    dim("organization", input.organizationRequiredComplete && input.organizationConfirmed ? "healthy":"incomplete","Organization"),
    dim("team-access", input.activeOwnerCount ? "healthy":"blocked","Team & Access"),
    dim("properties", input.invalidPropertyOwnership ? "blocked" : input.includedProperties ? input.propertySetupIssues ? "attention-needed":"healthy":"incomplete","Properties"),
    dim("connected-systems", !input.connectionRequired ? "not-applicable" : input.connectionStatus === "connected" ? "healthy" : ["degraded","attention-needed","syncing"].includes(input.connectionStatus) ? "degraded":"incomplete","Connected Systems"),
    dim("operational-data", ["degraded","unusable"].includes(input.operationalQuality) || ["failed","partially-succeeded"].includes(input.operationalSync) ? "degraded" : input.firstSyncComplete ? "healthy":"incomplete","Operational Data"),
    dim("notifications", input.criticalNotificationsAvailable ? input.notificationsConfirmed ? "healthy":"attention-needed":"degraded","Notifications"),
    dim("personal-preferences", input.preferencesValid ? "healthy":"attention-needed","Personal Preferences"),
  ];
  const blocked = dimensions.some(({status})=>status==="blocked"), degraded = dimensions.some(({status})=>status==="degraded");
  const incomplete = dimensions.some(({status})=>status==="incomplete"), attention = dimensions.some(({status})=>status==="attention-needed");
  const status: WorkspaceHealthStatus = blocked ? "blocked" : degraded ? "degraded" : incomplete ? "setup-required" : attention ? "attention-needed" : "ready";
  const tasks: OnboardingTask[] = [
    task("workspace_identity","Workspace identity established","required",input.identityValid,"system-evaluated"),
    task("organization_required","Business identity and regional defaults confirmed","required",input.organizationRequiredComplete && input.organizationConfirmed,"user-confirmed","/dashboard/workspace/organization",true),
    task("property_included","At least one canonical property included","required",input.includedProperties>0 && !input.invalidPropertyOwnership,"system-evaluated","/dashboard/workspace/properties",true),
    task("provider_ready","Operational system connected","required",!input.connectionRequired || input.connectionStatus==="connected","system-evaluated","/dashboard/workspace/connected-systems",true),
    task("first_sync","First synchronization completed","required",!input.connectionRequired || input.firstSyncComplete,"system-evaluated","/dashboard/workspace/connected-systems",true),
    task("owner_membership","Owner membership validated","required",input.activeOwnerCount>0,"system-evaluated","/dashboard/workspace/team",true),
    task("critical_notifications","Critical alerts available","required",input.criticalNotificationsAvailable,"system-evaluated","/dashboard/workspace/notifications"),
    task("notification_preferences","Personal notifications confirmed","recommended",input.notificationsConfirmed,"user-confirmed","/dashboard/workspace/notifications"),
    task("personal_preferences","Personal operating preferences reviewed","optional",input.preferencesValid,"user-confirmed","/dashboard/workspace/preferences"),
  ];
  const visibleTasks = tasks.filter((item)=>admin || !item.administratorOnly);
  const required = tasks.filter(({requirement})=>requirement==="required"), recommended = tasks.filter(({requirement})=>requirement==="recommended");
  const requiredComplete = required.filter(({complete})=>complete).length;
  const onboardingStatus = input.onboardingCompletedAt ? status === "ready" || status === "attention-needed" ? "completed":"needs-attention" : requiredComplete===required.length ? "ready-for-review" : requiredComplete ? "in-progress":"not-started";
  const filteredIssues = issues.sort((a,b)=>order[a.severity]-order[b.severity]).filter((item)=>admin || !item.action?.administratorOnly);
  return Object.freeze({ workspaceId:input.workspaceId,status,setup:blocked?"blocked":incomplete?"incomplete":attention?"attention-needed":"healthy",operations:blocked?"blocked":degraded?"degraded":"healthy",dimensions:Object.freeze(dimensions),issues:Object.freeze(filteredIssues),nextActions:Object.freeze(filteredIssues.flatMap(({action})=>action?[action]:[]).slice(0,3)),capabilities:Object.freeze(buildCapabilities(input,admin)),onboarding:Object.freeze({status:onboardingStatus,tasks:Object.freeze(visibleTasks),requiredCompleted:requiredComplete,requiredTotal:required.length,recommendedCompleted:recommended.filter(({complete})=>complete).length,recommendedTotal:recommended.length,completedAt:input.onboardingCompletedAt}),lastEvaluatedAt:now.toISOString(),evaluationVersion:"workspace-readiness-v1" });
}
function issue(code:string,dimension:WorkspaceHealthDimension,severity:WorkspaceIssueSeverity,title:string,description:string,impact:string,affectedCapabilities:string[],action:WorkspaceHealthAction|undefined,dismissible:boolean):WorkspaceHealthIssue{return{id:`health:${code}`,code,dimension,severity,title,description,impact,affectedCapabilities,action,dismissible};}
function dim(dimension:WorkspaceHealthDimension,status:WorkspaceDimensionStatus,label:string){return{dimension,status,label};}
function task(code:string,label:string,requirement:ReadinessRequirement,complete:boolean,source:OnboardingTask["source"],href?:string,administratorOnly?:boolean):OnboardingTask{return{code,label,requirement,complete,source,href,administratorOnly};}
function buildCapabilities(input:WorkspaceReadinessInput,admin:boolean):WorkspaceCapabilityHealth[]{return[
  {id:"workspace",label:"Workspace",availability:input.identityValid?"available":"unavailable",explanation:input.identityValid?"Identity and membership resolved.":"Identity cannot be resolved."},
  {id:"bookings",label:"Bookings",availability:!input.includedProperties?"not-configured":["degraded","unusable"].includes(input.operationalQuality)?"available-with-limitations":"available",explanation:!input.includedProperties?"No included property.":"Last-known operational data remains available."},
  {id:"connected-systems",label:"Connected Systems",availability:admin?(input.connectionStatus==="connected"?"available":"available-with-limitations"):"not-authorized",explanation:admin?"Connection health is visible.":"Connection management requires an Owner or Administrator."},
  {id:"intelligence",label:"Executive Intelligence",availability:input.includedProperties?"available":"not-configured",explanation:input.includedProperties?"Uses accessible operational evidence.":"No property evidence is available."},
];}
