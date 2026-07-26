import type{ContextValue,GuestContextProjection,OperationalIssueInput}from"./guest-context-projection";

export type CommunicationRecommendationPriority="critical"|"high"|"normal"|"informational";
export type CommunicationRecommendationConfidence="high"|"moderate"|"low";
export type CommunicationRecommendation=Readonly<{
 id:string;ruleId:string;actionKey:string;title:string;priority:CommunicationRecommendationPriority;
 confidence:CommunicationRecommendationConfidence;reason:string;explanation:readonly string[];
 suggestedTemplateCategory?:string;dependencies:readonly Readonly<{key:string;label:string;satisfied:boolean;recovery?:string}>[];
 href?:string;contextFingerprint:string;
}>;
export type RecommendationDisposition=Readonly<{actionKey:string;status:"completed"|"dismissed";contextFingerprint:string}>;
export type CommunicationTemplateDefinition=Readonly<{
 id:string;seriesKey:string;version:number;category:string;language:string;locale:string;subject?:string;
 body:string;variables:readonly string[];attachments:readonly Readonly<{type:string;reference:string;label:string}>[];
 deliveryMode:"immediate"|"scheduled"|"manual-hold";status:"draft"|"published"|"archived";
 createdAt:string;updatedAt:string;
}>;
export type RenderedCommunicationTemplate=Readonly<{templateId:string;templateVersion:number;subject?:string;body:string;resolvedVariables:Readonly<Record<string,string>>;attachments:CommunicationTemplateDefinition["attachments"];deliveryMode:"immediate"}>;

export function evaluateCommunicationGuidance(input:Readonly<{context:GuestContextProjection;dispositions?:readonly RecommendationDisposition[]}>):readonly CommunicationRecommendation[]{
 const{context}=input,recommendations:CommunicationRecommendation[]=[];
 const confidence=confidenceFromContext(context),fingerprint=(key:string)=>contextFingerprint(context,key);
 if(context.communication.waitingOn==="operator"){
  const waited=availableDate(context.communication.lastReply),hours=waited===null?0:Math.max(0,(Date.parse(context.generatedAt)-waited)/3_600_000);
  recommendations.push(recommendation({ruleId:"reply-waiting-operator.v1",actionKey:"reply",title:"Reply to guest",priority:hours>=8?"critical":"high",confidence,reason:hours>=8?`The guest has waited ${Math.floor(hours)} hours for a reply.`:"The conversation is waiting on an operator.",explanation:["A guest reply is the latest communication event.",hours>=8?"The response wait exceeds the eight-hour critical threshold.":"The response wait remains below the critical threshold."],suggestedTemplateCategory:"general-reply",dependencies:[],fingerprint:fingerprint("reply")}));
 }
 const arrival=["pre-arrival","arriving-today"].includes(context.reservation.stage);
 if(arrival){
  const guidebook=context.guidebook.publicUrl.state==="available",door=context.property.doorCode.state==="available";
  if(!guidebook)recommendations.push(recommendation({ruleId:"publish-guidebook-before-arrival.v1",actionKey:"publish-guidebook",title:"Publish guidebook",priority:context.reservation.stage==="arriving-today"?"critical":"high",confidence,reason:"Arrival is approaching and no published guidebook is available.",explanation:["The reservation is in an arrival workflow.","A guest-safe guidebook URL is unavailable."],dependencies:[],href:"/dashboard/guidebooks",fingerprint:fingerprint("publish-guidebook")}));
  if(!door)recommendations.push(recommendation({ruleId:"resolve-access-before-arrival.v1",actionKey:"resolve-access",title:"Add door code",priority:context.reservation.stage==="arriving-today"?"critical":"high",confidence,reason:"Arrival instructions cannot be completed without access details.",explanation:["The reservation is approaching arrival.","The canonical property context marks the door code unavailable."],dependencies:[],href:"/dashboard/properties",fingerprint:fingerprint("resolve-access")}));
  if(guidebook&&door)recommendations.push(recommendation({ruleId:"send-checkin-instructions.v1",actionKey:"send-checkin",title:"Send check-in instructions",priority:context.reservation.stage==="arriving-today"?"high":"normal",confidence,reason:"The guest is approaching arrival and required arrival information is available.",explanation:["The reservation is in an arrival workflow.","The guidebook is published.","Door access details are available."],suggestedTemplateCategory:"check-in",dependencies:[dependency("guidebook","Published guidebook",guidebook),dependency("door-code","Door code",door)],fingerprint:fingerprint("send-checkin")}));
 }
 const maintenance=context.operations.issues.filter(issue=>issue.type==="maintenance"&&issue.status!=="resolved");
 if(maintenance.length)recommendations.push(maintenanceRecommendation(context,maintenance,confidence,fingerprint("maintenance")));
 if(context.reservation.stage==="departing-today")recommendations.push(recommendation({ruleId:"checkout-reminder.v1",actionKey:"checkout-reminder",title:"Send checkout reminder",priority:"normal",confidence,reason:"The active reservation departs today.",explanation:["The reservation lifecycle is checkout today."],suggestedTemplateCategory:"checkout-reminder",dependencies:[],fingerprint:fingerprint("checkout-reminder")}));
 if(context.reservation.stage==="post-stay")recommendations.push(recommendation({ruleId:"review-request.v1",actionKey:"review-request",title:"Request a review",priority:"informational",confidence,reason:"The stay recently completed and is eligible for guest follow-up.",explanation:["The reservation is in the post-stay window."],suggestedTemplateCategory:"review-request",dependencies:[],fingerprint:fingerprint("review-request")}));
 const dispositions=input.dispositions??[];
 return Object.freeze(recommendations.filter(item=>!dispositions.some(disposition=>disposition.actionKey===item.actionKey&&disposition.contextFingerprint===item.contextFingerprint)).sort((a,b)=>priorityRank(a.priority)-priorityRank(b.priority)));
}

export function templateVariablesFromGuestContext(context:GuestContextProjection,hostName="Your host"):Readonly<Record<string,string>>{
 return Object.freeze({guestName:context.guest.preferredName.state==="available"?context.guest.preferredName.value:context.guest.name,propertyName:context.property.name,arrival:context.reservation.arrival,departure:context.reservation.departure,checkInTime:"",checkoutTime:"",doorCode:value(context.property.doorCode),wifi:value(context.property.wifi),parkingInstructions:value(context.property.parking),guidebookLink:value(context.guidebook.publicUrl),hostName});
}
export function renderVersionedCommunicationTemplate(template:CommunicationTemplateDefinition,values:Readonly<Record<string,string>>):RenderedCommunicationTemplate{
 if(template.status!=="published")throw new Error("communication_template_not_published");
 if(template.deliveryMode!=="immediate")throw new Error("communication_delivery_mode_not_enabled");
 const missing=template.variables.filter(variable=>!values[variable]?.trim());if(missing.length)throw new Error(`communication_template_variables_missing:${missing.join(",")}`);
 const render=(source:string)=>source.replace(/\{\{(\w+)\}\}/g,(_,key:string)=>values[key]??"");
 return Object.freeze({templateId:template.id,templateVersion:template.version,...(template.subject?{subject:render(template.subject)}:{}),body:render(template.body),resolvedVariables:Object.freeze(Object.fromEntries(template.variables.map(variable=>[variable,values[variable]]))),attachments:template.attachments,deliveryMode:"immediate"});
}
export class CommunicationTemplateRegistry{
 private templates=new Map<string,CommunicationTemplateDefinition[]>();
 register(template:CommunicationTemplateDefinition){const versions=this.templates.get(template.seriesKey)??[];if(versions.some(item=>item.version===template.version))throw new Error("communication_template_version_duplicate");this.templates.set(template.seriesKey,[...versions,deepFreeze({...template})]);return this;}
 resolve(category:string,language:string,locale?:string){const candidates=[...this.templates.values()].flat().filter(item=>item.category===category&&item.status==="published");return candidates.sort((a,b)=>score(b,language,locale)-score(a,language,locale)||b.version-a.version)[0]??null;}
}
function recommendation(input:{ruleId:string;actionKey:string;title:string;priority:CommunicationRecommendationPriority;confidence:CommunicationRecommendationConfidence;reason:string;explanation:string[];suggestedTemplateCategory?:string;dependencies:CommunicationRecommendation["dependencies"];href?:string;fingerprint:string}):CommunicationRecommendation{return deepFreeze({id:`${input.actionKey}:${input.fingerprint}`,ruleId:input.ruleId,actionKey:input.actionKey,title:input.title,priority:input.priority,confidence:input.confidence,reason:input.reason,explanation:input.explanation,...(input.suggestedTemplateCategory?{suggestedTemplateCategory:input.suggestedTemplateCategory}:{}),dependencies:input.dependencies,...(input.href?{href:input.href}:{}),contextFingerprint:input.fingerprint});}
function maintenanceRecommendation(context:GuestContextProjection,issues:readonly OperationalIssueInput[],confidence:CommunicationRecommendationConfidence,fingerprint:string){const urgent=issues.some(issue=>["urgent","high"].includes(issue.priority));return recommendation({ruleId:"maintenance-guest-impact.v1",actionKey:"maintenance",title:"Resolve maintenance communication",priority:urgent?"high":"normal",confidence,reason:`${issues.length} unresolved maintenance ${issues.length===1?"issue may":"issues may"} affect this stay.`,explanation:["The operational context contains unresolved maintenance work.","The operator should review impact before deciding what to communicate."],suggestedTemplateCategory:"issue-acknowledgement",dependencies:[dependency("maintenance-reviewed","Guest impact reviewed",false,"Open maintenance workspace")],href:"/dashboard/maintenance",fingerprint});}
function dependency(key:string,label:string,satisfied:boolean,recovery?:string){return Object.freeze({key,label,satisfied,...(recovery?{recovery}:{})});}
function availableDate(value:ContextValue<string>){return value.state==="available"?Date.parse(value.value):null;}
function value(input:ContextValue<string>){return input.state==="available"?input.value:"";}
function confidenceFromContext(context:GuestContextProjection):CommunicationRecommendationConfidence{return context.dataQuality.confidence==="limited"?"low":context.dataQuality.confidence==="moderate"?"moderate":"high";}
function contextFingerprint(context:GuestContextProjection,key:string){const source=[key,context.identity.conversationId,context.identity.reservationId,context.reservation.stage,context.communication.status,context.communication.waitingOn,context.guidebook.status.state,context.property.doorCode.state,context.operations.issues.map(issue=>`${issue.id}:${issue.status}`).sort().join("|")].join(":");let hash=2166136261;for(let index=0;index<source.length;index++){hash^=source.charCodeAt(index);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16).padStart(8,"0");}
function priorityRank(priority:CommunicationRecommendationPriority){return{critical:0,high:1,normal:2,informational:3}[priority];}
function score(template:CommunicationTemplateDefinition,language:string,locale?:string){return(template.language===language?10:template.language==="en"?1:0)+(locale&&template.locale===locale?5:0);}
function deepFreeze<T>(value:T):T{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;}
