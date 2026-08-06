import type { CanonicalGuidebook, CanonicalGuidebookSection, CanonicalGuidebookVersion, ContentRecord, GuidebookAnalyticsContext, GuidebookComponentInstance, GuidebookImportJob, GuidebookImportProposal, GuidebookMediaBinding, GuidebookPublication, GuidebookPublicationSnapshot, GuidebookTemplateAssignment, GuidebookValidationIssue, LocalizedContentVariant, PropertyVariableBinding } from "../domain/canonical-guidebook";

export const GUIDEBOOK_PERMISSIONS = Object.freeze(["guidebooks.view","guidebooks.create","guidebooks.edit","guidebooks.review","guidebooks.approve","guidebooks.publish","guidebooks.archive","content_records.view","content_records.create","content_records.edit","content_records.approve","media.view","media.manage","templates.assign","publications.view","publications.publish","publications.withdraw"] as const);
export type GuidebookPermission=(typeof GUIDEBOOK_PERMISSIONS)[number];
export type GuidebookCommandContext=Readonly<{workspaceId:string;actorId:string;permissions:ReadonlySet<GuidebookPermission>;propertyIds?:ReadonlySet<string>}>;
export type GuidebookEditorProjection=Readonly<{guidebook:CanonicalGuidebook;version:CanonicalGuidebookVersion;sections:readonly CanonicalGuidebookSection[];components:readonly GuidebookComponentInstance[];contentRecords:readonly ContentRecord[];variableBindings:readonly PropertyVariableBinding[];mediaBindings:readonly GuidebookMediaBinding[];templateAssignment:GuidebookTemplateAssignment|null;localizations:readonly LocalizedContentVariant[]}>;

export interface CanonicalGuidebookRepository {
  createGuidebook(value:CanonicalGuidebook):Promise<void>;
  updateGuidebookMetadata(value:CanonicalGuidebook,expectedUpdatedAt:string):Promise<void>;
  getGuidebook(workspaceId:string,id:string):Promise<CanonicalGuidebook|null>;
  listGuidebooks(workspaceId:string):Promise<readonly CanonicalGuidebook[]>;
  createDraftVersion(version:CanonicalGuidebookVersion):Promise<void>;
  getGuidebookVersion(workspaceId:string,id:string):Promise<CanonicalGuidebookVersion|null>;
  getGuidebookEditorProjection(workspaceId:string,guidebookId:string,versionId:string):Promise<GuidebookEditorProjection|null>;
  saveEditorProjection(projection:GuidebookEditorProjection,expectedVersionStatus:"draft"|"in_review"|"approved"):Promise<void>;
  transitionVersion(workspaceId:string,version:CanonicalGuidebookVersion,expectedStatus:string):Promise<void>;
}
export interface GuidebookPublicationRepository { findByIdempotencyKey(workspaceId:string,key:string):Promise<GuidebookPublication|null>; createPublication(publication:GuidebookPublication,snapshot:GuidebookPublicationSnapshot):Promise<void>; withdrawPublication(workspaceId:string,publicationId:string,actorId:string,at:string):Promise<void>; listPublications(workspaceId:string,guidebookId:string):Promise<readonly GuidebookPublication[]>; }
export interface GuidebookImportRepository { findJobByIdempotencyKey(workspaceId:string,key:string):Promise<GuidebookImportJob|null>; createImportJob(job:GuidebookImportJob):Promise<void>; listProposals(workspaceId:string,jobId:string):Promise<readonly GuidebookImportProposal[]>; reviewImportProposal(workspaceId:string,proposal:GuidebookImportProposal):Promise<void>; }
export interface GuidebookAuditPort { record(event:Readonly<{workspaceId:string;actorId:string;entityType:string;entityId:string;event:string;occurredAt:string;metadata:Readonly<Record<string,unknown>>}>):Promise<void>; }
export interface GuidebookAnalyticsPort { track(event:string,context:GuidebookAnalyticsContext,metadata:Readonly<Record<string,string|number|boolean|null>>):Promise<void>; }

/** Stable application boundary. Transport layers authorize first and delegate here. */
export interface CanonicalGuidebookApi {
  createGuidebook(input:unknown,context:GuidebookCommandContext):Promise<CanonicalGuidebook>;
  createDraftVersion(input:unknown,context:GuidebookCommandContext):Promise<CanonicalGuidebookVersion>;
  cloneVersion(input:unknown,context:GuidebookCommandContext):Promise<CanonicalGuidebookVersion>;
  updateGuidebookMetadata(input:unknown,context:GuidebookCommandContext):Promise<CanonicalGuidebook>;
  addSection(input:unknown,context:GuidebookCommandContext):Promise<CanonicalGuidebookSection>;
  updateSection(input:unknown,context:GuidebookCommandContext):Promise<CanonicalGuidebookSection>;
  reorderSections(input:unknown,context:GuidebookCommandContext):Promise<void>;
  removeSection(input:unknown,context:GuidebookCommandContext):Promise<void>;
  addComponentInstance(input:unknown,context:GuidebookCommandContext):Promise<GuidebookComponentInstance>;
  updateComponentInstance(input:unknown,context:GuidebookCommandContext):Promise<GuidebookComponentInstance>;
  reorderComponentInstances(input:unknown,context:GuidebookCommandContext):Promise<void>;
  removeComponentInstance(input:unknown,context:GuidebookCommandContext):Promise<void>;
  bindContentRecord(input:unknown,context:GuidebookCommandContext):Promise<void>;
  bindPropertyVariable(input:unknown,context:GuidebookCommandContext):Promise<void>;
  bindMediaAsset(input:unknown,context:GuidebookCommandContext):Promise<void>;
  requestReview(input:unknown,context:GuidebookCommandContext):Promise<void>;
  approveVersion(input:unknown,context:GuidebookCommandContext):Promise<void>;
  rejectVersion(input:unknown,context:GuidebookCommandContext):Promise<void>;
  validateVersion(input:unknown,context:GuidebookCommandContext):Promise<readonly GuidebookValidationIssue[]>;
  publishVersion(input:unknown,context:GuidebookCommandContext):Promise<GuidebookPublication>;
  withdrawPublication(input:unknown,context:GuidebookCommandContext):Promise<void>;
  createImportJob(input:unknown,context:GuidebookCommandContext):Promise<GuidebookImportJob>;
  reviewImportProposal(input:unknown,context:GuidebookCommandContext):Promise<GuidebookImportProposal>;
  getGuidebook(id:string,context:GuidebookCommandContext):Promise<CanonicalGuidebook|null>;
  getGuidebookVersion(id:string,context:GuidebookCommandContext):Promise<CanonicalGuidebookVersion|null>;
  getGuidebookEditorProjection(guidebookId:string,versionId:string,context:GuidebookCommandContext):Promise<GuidebookEditorProjection|null>;
  getGuidebookPreviewProjection(guidebookId:string,versionId:string,locale:string,context:GuidebookCommandContext):Promise<unknown>;
  getGuidebookValidationReport(versionId:string,context:GuidebookCommandContext):Promise<readonly GuidebookValidationIssue[]>;
  getPublishedGuidebookProjection(slug:string,channel:string):Promise<unknown>;
  listGuidebooks(context:GuidebookCommandContext):Promise<readonly CanonicalGuidebook[]>;
  listPublications(guidebookId:string,context:GuidebookCommandContext):Promise<readonly GuidebookPublication[]>;
}

export function authorizeGuidebook(context:GuidebookCommandContext,permission:GuidebookPermission,propertyId:string|null){if(!context.permissions.has(permission))throw new Error("GUIDEBOOK_PERMISSION_DENIED");if(propertyId&&context.propertyIds&&!context.propertyIds.has(propertyId))throw new Error("GUIDEBOOK_PROPERTY_SCOPE_DENIED");}
export function assertWorkspaceScope(context:GuidebookCommandContext,value:{workspaceId:string}){if(context.workspaceId!==value.workspaceId)throw new Error("GUIDEBOOK_WORKSPACE_SCOPE_DENIED");}
export function assertPublishedVersionImmutable(version:CanonicalGuidebookVersion){if(["published","superseded","archived"].includes(version.lifecycleStatus))throw new Error("GUIDEBOOK_VERSION_IMMUTABLE");}
export function assertPublishable(version:CanonicalGuidebookVersion,issues:readonly GuidebookValidationIssue[]){if(version.lifecycleStatus!=="approved")throw new Error("GUIDEBOOK_VERSION_NOT_APPROVED");if(issues.some(issue=>issue.blocking&&!issue.resolvedAt))throw new Error("GUIDEBOOK_VALIDATION_BLOCKED");}

export type CanonicalGuidebookApplication = Readonly<{
  createGuidebook: CanonicalGuidebookRepository["createGuidebook"];
  createDraftVersion: CanonicalGuidebookRepository["createDraftVersion"];
  cloneVersion: CanonicalGuidebookRepository["createDraftVersion"];
  updateGuidebookMetadata: CanonicalGuidebookRepository["updateGuidebookMetadata"];
  addSection(projection:GuidebookEditorProjection,section:CanonicalGuidebookSection):GuidebookEditorProjection;
  updateSection(projection:GuidebookEditorProjection,section:CanonicalGuidebookSection):GuidebookEditorProjection;
  reorderSections(projection:GuidebookEditorProjection,ids:readonly string[]):GuidebookEditorProjection;
  removeSection(projection:GuidebookEditorProjection,id:string):GuidebookEditorProjection;
  addComponentInstance(projection:GuidebookEditorProjection,component:GuidebookComponentInstance):GuidebookEditorProjection;
  updateComponentInstance(projection:GuidebookEditorProjection,component:GuidebookComponentInstance):GuidebookEditorProjection;
  reorderComponentInstances(projection:GuidebookEditorProjection,sectionId:string,ids:readonly string[]):GuidebookEditorProjection;
  removeComponentInstance(projection:GuidebookEditorProjection,id:string):GuidebookEditorProjection;
}>;

export const canonicalEditorOperations = Object.freeze({
  addSection:(p:GuidebookEditorProjection,s:CanonicalGuidebookSection)=>editable({...p,sections:[...p.sections,s]}),
  updateSection:(p:GuidebookEditorProjection,s:CanonicalGuidebookSection)=>editable({...p,sections:p.sections.map(value=>value.id===s.id?s:value)}),
  reorderSections:(p:GuidebookEditorProjection,ids:readonly string[])=>editable({...p,sections:ordered(p.sections,ids)}),
  removeSection:(p:GuidebookEditorProjection,id:string)=>editable({...p,sections:p.sections.filter(s=>s.id!==id),components:p.components.filter(c=>p.sections.find(s=>s.id===c.sectionId)?.id!==id)}),
  addComponentInstance:(p:GuidebookEditorProjection,c:GuidebookComponentInstance)=>editable({...p,components:[...p.components,c]}),
  updateComponentInstance:(p:GuidebookEditorProjection,c:GuidebookComponentInstance)=>editable({...p,components:p.components.map(value=>value.id===c.id?c:value)}),
  reorderComponentInstances:(p:GuidebookEditorProjection,sectionId:string,ids:readonly string[])=>editable({...p,components:[...p.components.filter(c=>c.sectionId!==sectionId),...ordered(p.components.filter(c=>c.sectionId===sectionId),ids)]}),
  removeComponentInstance:(p:GuidebookEditorProjection,id:string)=>editable({...p,components:p.components.filter(c=>c.id!==id),variableBindings:p.variableBindings.filter(b=>b.componentInstanceId!==id),mediaBindings:p.mediaBindings.filter(b=>b.componentInstanceId!==id)}),
});
function editable<T extends GuidebookEditorProjection>(value:T):T{assertPublishedVersionImmutable(value.version);return value}
function ordered<T extends {id:string;sortOrder:number}>(values:readonly T[],ids:readonly string[]):T[]{if(ids.length!==values.length||new Set(ids).size!==ids.length||ids.some(id=>!values.some(v=>v.id===id)))throw new Error("GUIDEBOOK_REORDER_INVALID");return ids.map((id,index)=>({...values.find(v=>v.id===id)!,sortOrder:index}));}
