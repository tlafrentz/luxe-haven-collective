import "server-only";
import { z } from "zod";
import { extractionResultSchema,guidebookProposalSchema,type CreationSource,type ExtractedFact,type ExtractionResult,type GuidebookProposal } from "./domain";
import { diagnoseNanoStructuredResponse, nanoSmokeJsonSchema } from "./openai-responses";

export type ProviderFailureKind="timeout"|"rate_limit"|"unavailable"|"invalid_output"|"terminal"|"reconciliation_required";
export type ProviderEvidence=Readonly<{providerRequestId?:string;configuredModel:string;resolvedSnapshot?:string;upstreamHttpStatus?:number;responseStatus?:"completed"|"incomplete"|"failed";incompleteReason?:string;inputTokens?:number;cachedInputTokens?:number;outputTokens?:number;reasoningTokens?:number;calculatedCostUsd?:number;latencyMs?:number;safeClassification:"response_received"|"provider_failure"|"transport_failure"|"timeout"|"incomplete";correlationId:string;recordedAt:string}>;
export type ProviderEvidenceContext=Readonly<{record(evidence:ProviderEvidence):Promise<string>;recordOutcome?(evidenceId:string,input:Readonly<{classification:"invalid_structured_output"|"application_schema_failure";schemaValidationPaths:readonly string[]}>):Promise<void>}>;
export class CreationProviderError extends Error{constructor(public readonly kind:ProviderFailureKind,message:string,public readonly retryable:boolean,public readonly httpStatus:number|null=null,public readonly usage?:ProviderUsage,public readonly requestId?:string,public readonly evidence?:ProviderEvidence){super(message);this.name="CreationProviderError"}}
export type ProviderSource=CreationSource&Readonly<{bytes:Uint8Array}>;
export type ProviderUsage=Readonly<Record<string,string|number>>;
export interface ExtractionProvider{readonly key:string;extract(input:Readonly<{sources:readonly ProviderSource[];correlationId:string;signal:AbortSignal;evidence?:ProviderEvidenceContext}>):Promise<Readonly<{result:ExtractionResult;requestId:string;usage?:ProviderUsage;evidenceId?:string}>>}
export interface GenerationProvider{readonly key:string;generate(input:Readonly<{facts:readonly ExtractedFact[];templateVersionId:string;allowedComponents:ReadonlyMap<string,string>;instructions:Readonly<Record<string,string|boolean>>;correlationId:string;signal:AbortSignal;evidence?:ProviderEvidenceContext}>):Promise<Readonly<{proposal:GuidebookProposal;requestId:string;usage?:ProviderUsage;evidenceId?:string}>>}

export class DeterministicCreationProvider implements ExtractionProvider,GenerationProvider{
  readonly key="deterministic-test.v1";
  constructor(private readonly extraction:ExtractionResult,private readonly proposal:GuidebookProposal){}
  async extract(){return{result:extractionResultSchema.parse(this.extraction),requestId:"deterministic-extraction"}}
  async generate(){return{proposal:guidebookProposalSchema.parse(this.proposal),requestId:"deterministic-generation"}}
}

export class HttpCreationProvider implements ExtractionProvider,GenerationProvider{
  readonly key="production-http.v1";
  constructor(private readonly config:Readonly<{endpoint:string;apiKey:string;timeoutMs?:number}>,private readonly fetcher:typeof fetch=fetch){}
  async extract(input:Parameters<ExtractionProvider["extract"]>[0]){const output=await this.request("extract",{sources:input.sources.map(s=>({id:s.id,type:s.sourceType,storageReference:s.storagePath,integrity:s.integritySha256}))},input.correlationId,input.signal,extractionResultSchema,"result");return{result:output.value,requestId:output.requestId,usage:output.usage}}
  async generate(input:Parameters<GenerationProvider["generate"]>[0]){const output=await this.request("generate",{facts:input.facts.map(f=>({id:f.id,category:f.category,field:f.field,value:f.correctedValue??f.normalizedValue,sourceId:f.sourceId})),templateVersionId:input.templateVersionId,components:Object.fromEntries(input.allowedComponents),instructions:input.instructions},input.correlationId,input.signal,guidebookProposalSchema,"proposal");return{proposal:output.value,requestId:output.requestId,usage:output.usage}}
  private async request<T>(operation:string,payload:unknown,correlationId:string,outerSignal:AbortSignal,schema:{parse(value:unknown):T},key:"result"|"proposal"):Promise<{value:T;requestId:string;usage?:Readonly<Record<string,number>>}>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),this.config.timeoutMs??30000),abort=()=>controller.abort();outerSignal.addEventListener("abort",abort,{once:true});
    try{const response=await this.fetcher(`${this.config.endpoint.replace(/\/$/,"")}/${operation}`,{method:"POST",headers:{authorization:`Bearer ${this.config.apiKey}`,"content-type":"application/json","x-correlation-id":correlationId},body:JSON.stringify(payload),signal:controller.signal});
      if(!response.ok)throw new CreationProviderError(response.status===429?"rate_limit":response.status>=500?"unavailable":"terminal","The creation provider could not complete the request.",response.status===429||response.status>=500);
      const body=await response.json() as Record<string,unknown>;
      try{return{value:schema.parse(body[key]),requestId:String(body.requestId??correlationId),...(body.usage&&typeof body.usage==="object"?{usage:body.usage as Record<string,number>}:{})}}catch{throw new CreationProviderError("invalid_output","The creation provider returned an invalid result.",false)}
    }catch(error){if(error instanceof CreationProviderError)throw error;if(controller.signal.aborted)throw new CreationProviderError("timeout","The creation provider timed out.",true);throw new CreationProviderError("unavailable","The creation provider is unavailable.",true)}finally{clearTimeout(timeout);outerSignal.removeEventListener("abort",abort)}
  }
}

const OPENAI_ENDPOINT="https://api.openai.com/v1/responses";
export const OPENAI_EXTRACTION_MODEL="gpt-5-nano";
export const OPENAI_GENERATION_MODEL="gpt-5-mini";
export const GUIDEBOOK_COST_CEILING_USD=1;
export const NANO_SMOKE_MAX_OUTPUT_TOKENS=512;

type DirectOpenAiConfig=Readonly<{apiKey:string;projectId?:string;extractionModel:string;generationModel:string;timeoutMs:number;allowExplicitFallback:boolean}>;
type DirectStage="extraction"|"generation"|"smoke";
const MODEL_PRICES:Readonly<Record<string,Readonly<{input:number;cachedInput:number;output:number}>>>={
  [OPENAI_EXTRACTION_MODEL]:{input:.05,cachedInput:.005,output:.4},
  [OPENAI_GENERATION_MODEL]:{input:.25,cachedInput:.025,output:2},
};
const guidebookProviderContentSchema=guidebookProposalSchema.omit({factIds:true,componentVersions:true});
const guidebookProviderWireSchema=z.object({
  title:z.string(),
  description:z.string(),
  sections:z.array(z.object({stableKey:z.string(),name:z.string(),body:z.string()})),
});

export class DirectOpenAiCreationProvider implements ExtractionProvider,GenerationProvider{
  readonly key:string;
  constructor(private readonly config:DirectOpenAiConfig,private readonly fetcher:typeof fetch=fetch){this.key=`openai.responses.v1:${config.extractionModel}:${config.generationModel}`}
  async extract(input:Parameters<ExtractionProvider["extract"]>[0]){
    const content:Record<string,unknown>[]=[{type:"input_text",text:extractionInstruction(input.sources)}];
    for(const source of input.sources){
      const parsed=deterministicText(source);
      if(parsed!==null)content.push({type:"input_text",text:`Source ${source.id} (${source.originalFilename}):\n${parsed}`});
      else{const data=Buffer.from(source.bytes).toString("base64"),url=`data:${source.mediaType};base64,${data}`;content.push(source.sourceType==="image"?{type:"input_image",image_url:url,detail:"high"}:{type:"input_file",filename:source.originalFilename,file_data:url})}
    }
    let output;try{output=await this.request("extraction",this.config.extractionModel,content,input.correlationId,input.signal,extractionOutputTokenAllowance(input.sources))}catch(error){await retainFailureEvidence(input.evidence,error);throw error}const evidenceId=await retainEvidence(input.evidence,evidenceFromOutput(output));
    try{return{result:parseResponse(output.text,extractionResultSchema),requestId:output.requestId,usage:output.usage,evidenceId}}catch(error){await input.evidence?.recordOutcome?.(evidenceId,{classification:"application_schema_failure",schemaValidationPaths:schemaPaths(error)});throw new CreationProviderError("invalid_output","The creation provider returned an invalid result.",false,null,output.usage,output.requestId)}
  }
  async generate(input:Parameters<GenerationProvider["generate"]>[0]){
    const safeFacts=input.facts.map(f=>({id:f.id,category:f.category,field:f.field,value:f.correctedValue??f.normalizedValue,sourceId:f.sourceId}));
    const text=["Analyze unresolved conflicts conservatively, then create one guidebook draft proposal as JSON. Use only supplied confirmed facts. Never invent operational information. Each section body must be concise plain text suitable for a canonical rich-text block.",...(input.instructions.allowImages===false?["Do not invent or describe media references. Images are attached after the canonical draft is saved."]:[]),`Template version: ${input.templateVersionId}`,`Allowed components: ${JSON.stringify(Object.fromEntries(input.allowedComponents))}`,`Presentation instructions: ${JSON.stringify(input.instructions)}`,`Confirmed facts: ${JSON.stringify(safeFacts)}`].join("\n");
    const requestedFallback=input.instructions.explicitModelFallback===true;
    if(requestedFallback)throw new CreationProviderError("terminal","The requested model fallback policy is disabled.",false);
    const model=this.config.generationModel;
    let output;try{output=await this.request("generation",model,[{type:"input_text",text}],input.correlationId,input.signal,4000)}catch(error){await retainFailureEvidence(input.evidence,error);throw error}const evidenceId=await retainEvidence(input.evidence,evidenceFromOutput(output));
    try{const parsed=parseProviderProposal(output.text),componentVersions=[...input.allowedComponents].map(([key,versionId])=>({key,versionId})),proposal=guidebookProposalSchema.parse({...parsed,factIds:safeFacts.map(fact=>fact.id),componentVersions});return{proposal,requestId:output.requestId,usage:output.usage,evidenceId}}catch(error){await input.evidence?.recordOutcome?.(evidenceId,{classification:"application_schema_failure",schemaValidationPaths:schemaPaths(error)});throw new CreationProviderError("invalid_output","The creation provider returned an invalid result.",true,null,output.usage,output.requestId)}
  }
  async verifyNanoGeneration(input:Readonly<{correlationId:string;signal:AbortSignal}>){
    if(this.config.extractionModel!==OPENAI_EXTRACTION_MODEL)throw new CreationProviderError("terminal","The creation provider model is not approved.",false);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),this.config.timeoutMs),abort=()=>controller.abort(),started=performance.now();input.signal.addEventListener("abort",abort,{once:true});
    try{const response=await this.fetcher(OPENAI_ENDPOINT,{method:"POST",headers:{authorization:`Bearer ${this.config.apiKey}`,"content-type":"application/json","x-client-request-id":input.correlationId,...(this.config.projectId?{"OpenAI-Project":this.config.projectId}:{})},body:JSON.stringify({model:OPENAI_EXTRACTION_MODEL,store:false,input:"Return the minimal verification object.",text:{format:{type:"json_schema",name:"openai_nano_generation_smoke_v3",strict:true,schema:nanoSmokeJsonSchema}},reasoning:{effort:"minimal"},max_output_tokens:NANO_SMOKE_MAX_OUTPUT_TOKENS}),signal:controller.signal});const body=await response.json().catch(()=>({})),diagnostic=diagnoseNanoStructuredResponse({body,httpStatus:response.status,openaiRequestId:response.headers.get("x-request-id"),latencyMs:performance.now()-started,correlationId:input.correlationId});return diagnostic}catch{if(controller.signal.aborted)throw new CreationProviderError("timeout","The creation provider timed out.",true);throw new CreationProviderError("unavailable","The creation provider is unavailable.",true)}finally{clearTimeout(timeout);input.signal.removeEventListener("abort",abort)}
  }
  private async request(stage:DirectStage,model:string,content:Record<string,unknown>[],correlationId:string,outerSignal:AbortSignal,maxOutputTokens:number){
    assertRequestWithinBudget(model,content,maxOutputTokens);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),this.config.timeoutMs),abort=()=>controller.abort(),started=performance.now();outerSignal.addEventListener("abort",abort,{once:true});
    try{const response=await this.fetcher(OPENAI_ENDPOINT,{method:"POST",headers:{authorization:`Bearer ${this.config.apiKey}`,"content-type":"application/json","x-client-request-id":correlationId,...(this.config.projectId?{"OpenAI-Project":this.config.projectId}:{})},body:JSON.stringify({model,store:false,input:[{role:"user",content}],text:{format:{type:"json_schema",name:stage==="extraction"?"guidebook_extraction":"guidebook_proposal",strict:true,schema:strictJsonSchema(stage==="extraction"?extractionResultSchema:guidebookProposalSchema)}},reasoning:{effort:stage==="extraction"?"minimal":"low"},max_output_tokens:maxOutputTokens}),signal:controller.signal});const openaiRequestId=response.headers.get("x-request-id")??undefined,latencyMs=Math.max(0,Math.round(performance.now()-started));if(!response.ok)throw new CreationProviderError(response.status===429?"rate_limit":response.status>=500?"unavailable":"terminal","The creation provider could not complete the request.",response.status===429||response.status>=500,response.status,undefined,openaiRequestId,{providerRequestId:openaiRequestId,configuredModel:model,upstreamHttpStatus:response.status,responseStatus:"failed",latencyMs,safeClassification:"provider_failure",correlationId,recordedAt:new Date().toISOString()});const body=await response.json()as Record<string,unknown>,requestId=openaiRequestId??String(body.id??correlationId),resolvedSnapshot=typeof body.model==="string"?body.model:model,usage={...pricedUsage(body.usage,model,stage,latencyMs),configured_model:model,resolved_snapshot:resolvedSnapshot,openai_request_id:openaiRequestId??"unavailable",correlation_id:correlationId},evidence=evidenceFromUsage({requestId,model,resolvedSnapshot,httpStatus:response.status,responseStatus:typeof body.status==="string"?body.status:"completed",incompleteReason:(body.incomplete_details as Record<string,unknown>|undefined)?.reason,usage,correlationId});if(Number(usage.calculated_cost_usd??0)>GUIDEBOOK_COST_CEILING_USD)throw new CreationProviderError("terminal","The guidebook cost ceiling was exceeded.",false,response.status,usage,requestId,evidence);if(body.status==="incomplete"){const reason=(body.incomplete_details as Record<string,unknown>|undefined)?.reason;throw new CreationProviderError("invalid_output","The creation provider returned an incomplete result.",reason==="max_output_tokens",response.status,usage,requestId,{...evidence,safeClassification:"incomplete"})}const text=responseText(body);if(!text)throw new CreationProviderError("invalid_output","The creation provider returned an invalid result.",false,response.status,usage,requestId,evidence);return{text,requestId,httpStatus:response.status,openaiRequestId,model:resolvedSnapshot,usage,evidence}}catch(error){if(error instanceof CreationProviderError)throw error;const latencyMs=Math.max(0,Math.round(performance.now()-started)),timedOut=controller.signal.aborted;throw new CreationProviderError(timedOut?"timeout":"unavailable",timedOut?"The creation provider timed out.":"The creation provider is unavailable.",true,null,undefined,undefined,{configuredModel:model,latencyMs,safeClassification:timedOut?"timeout":"transport_failure",correlationId,recordedAt:new Date().toISOString()})}finally{clearTimeout(timeout);outerSignal.removeEventListener("abort",abort)}
  }
}

function extractionInstruction(sources:readonly ProviderSource[]){return["Extract structured guidebook facts from the attached controlled sources. Return JSON with facts, missing, warnings, mediaCandidates, and unsupported.","Do not invent facts or silently resolve conflicts. When the same field has different stated values, return every value as conflicting with the same non-empty conflictGroup. When the source explicitly says information is omitted, return that field in missing. Never mark provider-extracted facts confirmed; use needs_review unless the value is conflicting or missing.","Known access, Wi-Fi, safety, parking, occupancy, policy, and checkout facts are high risk. Classify maximum occupancy as rules.occupancy_limit with highRisk true. Never return permanent secret values: use null and needs_review.",`Sources in attachment order: ${JSON.stringify(sources.map(s=>({id:s.id,type:s.sourceType,filename:s.originalFilename})))}`].join("\n")}
function responseText(body:Record<string,unknown>){if(typeof body.output_text==="string")return body.output_text;const output=Array.isArray(body.output)?body.output:[];for(const item of output){if(!item||typeof item!=="object")continue;for(const part of Array.isArray((item as Record<string,unknown>).content)?(item as Record<string,unknown>).content as unknown[]:[]){if(part&&typeof part==="object"&&typeof(part as Record<string,unknown>).text==="string")return String((part as Record<string,unknown>).text)}}return""}
function safeUsage(value:unknown){if(!value||typeof value!=="object")return undefined;const v=value as Record<string,unknown>,usage:Record<string,number>={};for(const key of["input_tokens","output_tokens","total_tokens"]){if(typeof v[key]==="number"&&Number.isFinite(v[key]))usage[key]=v[key]}return Object.keys(usage).length?usage:undefined}
const NULLABLE_OPTIONAL_PROVIDER_FIELDS=new Set(["displayValue","sourceId","sourceLocation","confidence","conflictGroup","title","emphasis","caption"]);
function normalizeProviderOptionals(value:unknown):unknown{
  if(Array.isArray(value))return value.map(normalizeProviderOptionals);
  if(!value||typeof value!=="object")return value;
  return Object.fromEntries(Object.entries(value as Record<string,unknown>).flatMap(([key,child])=>child===null&&NULLABLE_OPTIONAL_PROVIDER_FIELDS.has(key)?[]:[[key,normalizeProviderOptionals(child)]]));
}
function parseResponse<T>(text:string,schema:{parse(value:unknown):T}){return schema.parse(normalizeProviderOptionals(JSON.parse(text)))}
function parseProviderProposal(text:string){const value=guidebookProviderWireSchema.parse(normalizeProviderOptionals(JSON.parse(text)));return guidebookProviderContentSchema.parse({title:value.title,description:value.description,sections:value.sections.map(section=>({stableKey:section.stableKey,name:section.name,blocks:[{type:"rich-text" as const,content:{text:section.body}}]}))})}
async function retainEvidence(context:ProviderEvidenceContext|undefined,evidence:ProviderEvidence){if(!context)return"unretained";try{return await context.record(evidence)}catch{throw new CreationProviderError("reconciliation_required","Provider evidence persistence requires reconciliation.",false,null,undefined,evidence.providerRequestId,evidence)}}
async function retainFailureEvidence(context:ProviderEvidenceContext|undefined,error:unknown){if(!(error instanceof CreationProviderError)||!error.evidence)return;if(!context)throw error;await retainEvidence(context,error.evidence)}
function evidenceFromOutput(output:Readonly<{requestId:string;httpStatus:number;model:string;usage:ProviderUsage;evidence:ProviderEvidence}>){return output.evidence}
function evidenceFromUsage(input:Readonly<{requestId:string;model:string;resolvedSnapshot:string;httpStatus:number;responseStatus:unknown;incompleteReason:unknown;usage:ProviderUsage;correlationId:string}>):ProviderEvidence{return{providerRequestId:input.requestId,configuredModel:input.model,resolvedSnapshot:input.resolvedSnapshot,upstreamHttpStatus:input.httpStatus,responseStatus:["completed","incomplete","failed"].includes(String(input.responseStatus))?String(input.responseStatus)as"completed"|"incomplete"|"failed":"completed",...(typeof input.incompleteReason==="string"?{incompleteReason:input.incompleteReason}:{}),inputTokens:Number(input.usage.input_tokens??0),cachedInputTokens:Number(input.usage.cached_input_tokens??0),outputTokens:Number(input.usage.output_tokens??0),reasoningTokens:Number(input.usage.reasoning_tokens??0),calculatedCostUsd:Number(input.usage.calculated_cost_usd??0),latencyMs:Number(input.usage.latency_ms??0),safeClassification:"response_received",correlationId:input.correlationId,recordedAt:new Date().toISOString()}}
function schemaPaths(error:unknown){if(error instanceof z.ZodError)return error.issues.map(issue=>issue.path.length?`$.${issue.path.join(".")}`:"$");return["$"]}
function strictJsonSchema(schema:z.ZodType){const providerSchema=schema===guidebookProposalSchema?guidebookProviderWireSchema:schema,root=z.toJSONSchema(providerSchema)as Record<string,unknown>;delete root.$schema;const visit=(value:unknown)=>{if(!value||typeof value!=="object")return;const record=value as Record<string,unknown>,properties=record.properties;if(properties&&typeof properties==="object"&&!Array.isArray(properties)){record.additionalProperties=false;record.required=Object.keys(properties as Record<string,unknown>)}for(const child of Object.values(record))if(Array.isArray(child))child.forEach(visit);else visit(child)};visit(root);return root}
function deterministicText(source:ProviderSource){if(source.sourceType!=="text"&&!/^text\//.test(source.mediaType))return null;return new TextDecoder("utf-8",{fatal:false}).decode(source.bytes).replace(/\r\n?/g,"\n").normalize("NFC")}
function pricedUsage(value:unknown,model:string,stage:DirectStage,latencyMs:number){const base=safeUsage(value)??{},record=value&&typeof value==="object"?value as Record<string,unknown>:undefined,inputDetail=record?.input_tokens_details,outputDetail=record?.output_tokens_details,inputRecord=inputDetail&&typeof inputDetail==="object"?inputDetail as Record<string,unknown>:undefined,outputRecord=outputDetail&&typeof outputDetail==="object"?outputDetail as Record<string,unknown>:undefined,cached=typeof inputRecord?.cached_tokens==="number"?inputRecord.cached_tokens:0,reasoning=typeof outputRecord?.reasoning_tokens==="number"?outputRecord.reasoning_tokens:0,input=base.input_tokens??0,output=base.output_tokens??0,prices=MODEL_PRICES[model];if(!prices)throw new CreationProviderError("terminal","The creation provider model is not approved.",false);const cost=((input-cached)*prices.input+cached*prices.cachedInput+output*prices.output)/1_000_000;return{model,stage,...base,cached_input_tokens:cached,reasoning_tokens:reasoning,latency_ms:Math.max(0,Math.round(latencyMs)),calculated_cost_usd:Number(cost.toFixed(8))}}
function assertRequestWithinBudget(model:string,content:Record<string,unknown>[],maxOutputTokens:number){const prices=MODEL_PRICES[model];if(!prices)throw new CreationProviderError("terminal","The creation provider model is not approved.",false);const bytes=new TextEncoder().encode(JSON.stringify(content)).byteLength,estimatedInputTokens=Math.ceil(bytes/3),maximumCost=(estimatedInputTokens*prices.input+maxOutputTokens*prices.output)/1_000_000;if(maximumCost>GUIDEBOOK_COST_CEILING_USD)throw new CreationProviderError("terminal","The guidebook cost ceiling would be exceeded.",false)}
export function extractionOutputTokenAllowance(sources:readonly Pick<ProviderSource,"byteSize">[]){const totalBytes=sources.reduce((sum,source)=>sum+source.byteSize,0),expectedFacts=Math.min(500,Math.max(10,Math.ceil(totalBytes/500)));return Math.min(65536,Math.max(4096,2048+expectedFacts*128))}

export function productionProviderFromEnvironment(){
  if(process.env.GUIDEBOOK_CREATION_KILL_SWITCH==="true")return null;
  const timeout=Number(process.env.GUIDEBOOK_CREATION_PROVIDER_TIMEOUT_MS??"60000");
  if(!Number.isInteger(timeout)||timeout<5000||timeout>120000)return null;
  if(process.env.GUIDEBOOK_CREATION_ADAPTER==="openai-direct"){
    const apiKey=process.env.OPENAI_API_KEY,extractionModel=process.env.GUIDEBOOK_CREATION_EXTRACTION_MODEL??OPENAI_EXTRACTION_MODEL,generationModel=process.env.GUIDEBOOK_CREATION_GENERATION_MODEL??OPENAI_GENERATION_MODEL;
    if(!apiKey||extractionModel!==OPENAI_EXTRACTION_MODEL||generationModel!==OPENAI_GENERATION_MODEL)return null;
    if(process.env.GUIDEBOOK_CREATION_ALLOW_GPT54_FALLBACK==="true")return null;
    return new DirectOpenAiCreationProvider({apiKey,projectId:process.env.OPENAI_PROJECT_ID,extractionModel,generationModel,timeoutMs:timeout,allowExplicitFallback:false});
  }
  return null;
}

export function controlledVerificationProviderFromEnvironment(runScopedAuthorization=false){
  if(!runScopedAuthorization&&(process.env.CONTROLLED_GUIDEBOOK_JOURNEY_ENABLED!=="true"||process.env.CONTROLLED_GUIDEBOOK_JOURNEY_KILL_SWITCH==="true"))return null;
  const timeout=Number(process.env.GUIDEBOOK_CREATION_PROVIDER_TIMEOUT_MS??"60000"),apiKey=process.env.OPENAI_API_KEY,projectId=process.env.OPENAI_PROJECT_ID,extractionModel=process.env.GUIDEBOOK_CREATION_EXTRACTION_MODEL??OPENAI_EXTRACTION_MODEL,generationModel=process.env.GUIDEBOOK_CREATION_GENERATION_MODEL??OPENAI_GENERATION_MODEL;
  if(!Number.isInteger(timeout)||timeout<5000||timeout>120000||!apiKey||!projectId||extractionModel!==OPENAI_EXTRACTION_MODEL||generationModel!==OPENAI_GENERATION_MODEL||process.env.GUIDEBOOK_CREATION_ALLOW_GPT54_FALLBACK==="true")return null;
  return new DirectOpenAiCreationProvider({apiKey,projectId,extractionModel,generationModel,timeoutMs:timeout,allowExplicitFallback:false});
}
