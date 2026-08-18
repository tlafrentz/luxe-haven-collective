import { z } from "zod";

export const CREATION_STATES = ["draft","uploading","ready_for_extraction","extracting","awaiting_review","ready_to_generate","generating","completed","failed","cancelled"] as const;
export const REVIEW_STATUSES = ["confirmed","needs_review","missing","conflicting","rejected"] as const;
export type CreationState = (typeof CREATION_STATES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type SourceType = "pdf"|"docx"|"text"|"image";

export const HIGH_RISK_FIELDS = new Set([
  "property.address","arrival.access_instructions","arrival.door_code","arrival.gate_code","arrival.alarm_instructions",
  "wifi.credentials","safety.emergency_contact","parking.restrictions","rules.occupancy_limit","rules.quiet_hours",
  "rules.pet_policy","safety.equipment_instructions","checkout.obligations","policy.fees","policy.penalties","policy.legal",
]);
export const SECRET_FIELDS = new Set(["arrival.door_code","arrival.gate_code","wifi.credentials"]);

export type CreationJob = Readonly<{
  id:string; workspaceId:string; propertyId:string; guidebookId?:string; actorId:string; actorRole:string;
  templateVersionId?:string; state:CreationState; currentStage:string; idempotencyKey:string; attemptCount:number;
  expectedDraftRevision?:number; resultingDraftRevision?:number; correlationId:string; failureClass?:string;
}>;
export type CreationSource = Readonly<{
  id:string; jobId:string; workspaceId:string; sourceType:SourceType; originalFilename:string; storagePath:string;
  mediaType:string; byteSize:number; integritySha256:string; extractionStatus:"pending"|"processing"|"completed"|"failed"|"unsupported";
}>;
export type ExtractedFact = Readonly<{
  id:string; jobId:string; category:string; field:string; normalizedValue:unknown; displayValue?:string;
  sourceId?:string; sourceLocation?:string; confidence?:number; reviewStatus:ReviewStatus; conflictGroup?:string;
  sensitivity:"public"|"internal"|"sensitive"|"secret"; highRisk:boolean; correctedValue?:unknown; confirmed:boolean;
}>;

const factSchema = z.object({
  category:z.string().min(1).max(80), field:z.string().min(1).max(120), normalizedValue:z.union([z.string(),z.number(),z.boolean(),z.null()]),
  displayValue:z.string().max(2000).optional(), sourceId:z.string().min(1).optional(), sourceLocation:z.string().max(300).optional(),
  confidence:z.number().min(0).max(1).optional(), reviewStatus:z.enum(REVIEW_STATUSES), conflictGroup:z.string().optional(),
  sensitivity:z.enum(["public","internal","sensitive","secret"]), highRisk:z.boolean(),
}).superRefine((value,context)=>{
  if(value.reviewStatus==="conflicting"&&!value.conflictGroup) context.addIssue({code:"custom",message:"Conflicting facts require a conflict group."});
  if(value.sensitivity==="secret"&&value.normalizedValue!==null) context.addIssue({code:"custom",message:"Permanent secrets cannot be stored as extracted values."});
  const expected=HIGH_RISK_FIELDS.has(`${value.category}.${value.field}`);
  if(expected&&!value.highRisk) context.addIssue({code:"custom",message:"Known operational fields must be classified high risk."});
});

export const extractionResultSchema = z.object({
  facts:z.array(factSchema).max(500), missing:z.array(z.object({category:z.string(),field:z.string(),highRisk:z.boolean()})).max(100),
  warnings:z.array(z.object({code:z.string().max(80),message:z.string().max(300)})).max(100),
  mediaCandidates:z.array(z.object({sourceId:z.string(),suggestedSection:z.string().max(100),confidence:z.number().min(0).max(1)})).max(100),
  unsupported:z.array(z.object({sourceId:z.string(),reason:z.string().max(300)})).max(100),
});
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

const blockSchema=z.discriminatedUnion("type",[
  z.object({type:z.literal("heading"),content:z.object({text:z.string().min(1).max(300),level:z.union([z.literal(2),z.literal(3),z.literal(4)])})}),
  z.object({type:z.literal("rich-text"),content:z.object({text:z.string().min(1).max(12000)})}),
  z.object({type:z.literal("instruction"),content:z.object({title:z.string().max(200).optional(),steps:z.array(z.string().min(1).max(1000)).max(50),emphasis:z.enum(["standard","important"]).optional()})}),
  z.object({type:z.literal("callout"),content:z.object({kind:z.enum(["information","reminder","warning"]),title:z.string().max(200).optional(),body:z.string().min(1).max(4000)})}),
  z.object({type:z.literal("checklist"),content:z.object({title:z.string().max(200).optional(),items:z.array(z.string().min(1).max(1000)).max(50)})}),
  z.object({type:z.literal("image"),content:z.object({mediaRef:z.string().min(1),alt:z.string().max(500),caption:z.string().max(1000).optional()})}),
]);
export const guidebookProposalSchema=z.object({
  title:z.string().min(1).max(200), description:z.string().max(2000), sections:z.array(z.object({stableKey:z.string().min(1).max(80),name:z.string().min(1).max(120),blocks:z.array(blockSchema).max(100)})).min(1).max(40),
  factIds:z.array(z.string()).max(500), componentVersions:z.array(z.object({key:z.string(),versionId:z.string()})).max(100),
}).strict();
export type GuidebookProposal=z.infer<typeof guidebookProposalSchema>;

export function generationReadiness(facts:readonly ExtractedFact[]){
  const unresolved=facts.filter(f=>f.reviewStatus==="missing"||f.reviewStatus==="conflicting"||f.reviewStatus==="needs_review");
  const unconfirmedHighRisk=facts.filter(f=>f.highRisk&&f.reviewStatus==="confirmed"&&!f.confirmed);
  return {ready:unresolved.length===0&&unconfirmedHighRisk.length===0,unresolved,unconfirmedHighRisk};
}
export function sensitivityFor(category:string,field:string){return SECRET_FIELDS.has(`${category}.${field}`)?"secret" as const:"internal" as const}

export function sanitizeFilename(value:string){
  const base=value.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,180);
  return base||"source";
}
export const SOURCE_LIMITS={count:20,bytesPerFile:25*1024*1024,totalBytes:100*1024*1024} as const;
export function inspectSource(bytes:Uint8Array,declaredType:string):SourceType|null{
  const starts=(values:number[])=>values.every((v,i)=>bytes[i]===v);
  if(starts([0x25,0x50,0x44,0x46,0x2d])) return declaredType==="application/pdf"?"pdf":null;
  if(starts([0x50,0x4b,0x03,0x04])) return declaredType==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"?"docx":null;
  if(starts([0xff,0xd8,0xff])||starts([0x89,0x50,0x4e,0x47])||(bytes.length>12&&new TextDecoder().decode(bytes.slice(8,12))==="WEBP")) return ["image/jpeg","image/png","image/webp"].includes(declaredType)?"image":null;
  if(declaredType==="text/plain"&&!bytes.includes(0)&&new TextDecoder("utf-8",{fatal:true}).decode(bytes).length) return "text";
  return null;
}

export function assertProposalSafe(proposal:GuidebookProposal,allowedComponents:ReadonlyMap<string,string>){
  const parsed=guidebookProposalSchema.parse(proposal);
  for(const component of parsed.componentVersions) if(allowedComponents.get(component.key)!==component.versionId) throw new Error("COMPONENT_VERSION_NOT_READY");
  const serialized=JSON.stringify(parsed);
  if(/<script|javascript:|onerror\s*=|onload\s*=/i.test(serialized)) throw new Error("GENERATED_CONTENT_UNSAFE");
  return parsed;
}
