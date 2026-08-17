import "server-only";
import { z } from "zod";
import { extractionResultSchema,guidebookProposalSchema,type CreationSource,type ExtractedFact,type ExtractionResult,type GuidebookProposal } from "./domain";
import { diagnoseNanoStructuredResponse, nanoSmokeJsonSchema } from "./openai-responses";

export type ProviderFailureKind="timeout"|"rate_limit"|"unavailable"|"invalid_output"|"terminal";
export class CreationProviderError extends Error{constructor(public readonly kind:ProviderFailureKind,message:string,public readonly retryable:boolean,public readonly httpStatus:number|null=null,public readonly usage?:ProviderUsage,public readonly requestId?:string){super(message);this.name="CreationProviderError"}}
export type ProviderSource=CreationSource&Readonly<{bytes:Uint8Array}>;
export type ProviderUsage=Readonly<Record<string,string|number>>;
export interface ExtractionProvider{readonly key:string;extract(input:Readonly<{sources:readonly ProviderSource[];correlationId:string;signal:AbortSignal}>):Promise<Readonly<{result:ExtractionResult;requestId:string;usage?:ProviderUsage}>>}
export interface GenerationProvider{readonly key:string;generate(input:Readonly<{facts:readonly ExtractedFact[];templateVersionId:string;allowedComponents:ReadonlyMap<string,string>;instructions:Readonly<Record<string,string|boolean>>;correlationId:string;signal:AbortSignal}>):Promise<Readonly<{proposal:GuidebookProposal;requestId:string;usage?:ProviderUsage}>>}

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

const GATEWAY_ENDPOINT="https://ai-gateway.vercel.sh/v1/responses";
export const CREATION_PROVIDER_CANDIDATE="openai/gpt-5-mini";
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
    const output=await this.request("extraction",this.config.extractionModel,content,input.correlationId,input.signal,extractionOutputTokenAllowance(input.sources));
    try{return{result:parseResponse(output.text,extractionResultSchema),requestId:output.requestId,usage:output.usage}}catch{throw new CreationProviderError("invalid_output","The creation provider returned an invalid result.",false,null,output.usage,output.requestId)}
  }
  async generate(input:Parameters<GenerationProvider["generate"]>[0]){
    const safeFacts=input.facts.map(f=>({id:f.id,category:f.category,field:f.field,value:f.correctedValue??f.normalizedValue,sourceId:f.sourceId}));
    const text=["Analyze unresolved conflicts conservatively, then create one guidebook draft proposal as JSON. Use only supplied confirmed facts. Never invent operational information.",`Template version: ${input.templateVersionId}`,`Allowed components: ${JSON.stringify(Object.fromEntries(input.allowedComponents))}`,`Presentation instructions: ${JSON.stringify(input.instructions)}`,`Confirmed facts: ${JSON.stringify(safeFacts)}`].join("\n");
    const requestedFallback=input.instructions.explicitModelFallback===true;
    if(requestedFallback)throw new CreationProviderError("terminal","The requested model fallback policy is disabled.",false);
    const model=this.config.generationModel;
    const output=await this.request("generation",model,[{type:"input_text",text}],input.correlationId,input.signal,12000);
    try{return{proposal:parseResponse(output.text,guidebookProposalSchema),requestId:output.requestId,usage:output.usage}}catch{throw new CreationProviderError("invalid_output","The creation provider returned an invalid result.",false,null,output.usage,output.requestId)}
  }
  async verifyNanoGeneration(input:Readonly<{correlationId:string;signal:AbortSignal}>){
    if(this.config.extractionModel!==OPENAI_EXTRACTION_MODEL)throw new CreationProviderError("terminal","The creation provider model is not approved.",false);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),this.config.timeoutMs),abort=()=>controller.abort(),started=performance.now();input.signal.addEventListener("abort",abort,{once:true});
    try{const response=await this.fetcher(OPENAI_ENDPOINT,{method:"POST",headers:{authorization:`Bearer ${this.config.apiKey}`,"content-type":"application/json","x-client-request-id":input.correlationId,...(this.config.projectId?{"OpenAI-Project":this.config.projectId}:{})},body:JSON.stringify({model:OPENAI_EXTRACTION_MODEL,store:false,input:"Return the minimal verification object.",text:{format:{type:"json_schema",name:"openai_nano_generation_smoke_v3",strict:true,schema:nanoSmokeJsonSchema}},reasoning:{effort:"minimal"},max_output_tokens:NANO_SMOKE_MAX_OUTPUT_TOKENS}),signal:controller.signal});const body=await response.json().catch(()=>({})),diagnostic=diagnoseNanoStructuredResponse({body,httpStatus:response.status,openaiRequestId:response.headers.get("x-request-id"),latencyMs:performance.now()-started,correlationId:input.correlationId});return diagnostic}catch{if(controller.signal.aborted)throw new CreationProviderError("timeout","The creation provider timed out.",true);throw new CreationProviderError("unavailable","The creation provider is unavailable.",true)}finally{clearTimeout(timeout);input.signal.removeEventListener("abort",abort)}
  }
  private async request(stage:DirectStage,model:string,content:Record<string,unknown>[],correlationId:string,outerSignal:AbortSignal,maxOutputTokens:number){
    assertRequestWithinBudget(model,content,maxOutputTokens);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),this.config.timeoutMs),abort=()=>controller.abort(),started=performance.now();outerSignal.addEventListener("abort",abort,{once:true});
    try{const response=await this.fetcher(OPENAI_ENDPOINT,{method:"POST",headers:{authorization:`Bearer ${this.config.apiKey}`,"content-type":"application/json","x-client-request-id":correlationId,...(this.config.projectId?{"OpenAI-Project":this.config.projectId}:{})},body:JSON.stringify({model,store:false,input:[{role:"user",content}],text:{format:{type:"json_schema",name:stage==="extraction"?"guidebook_extraction":"guidebook_proposal",strict:true,schema:strictJsonSchema(stage==="extraction"?extractionResultSchema:guidebookProposalSchema)}},reasoning:{effort:stage==="extraction"?"minimal":"low"},max_output_tokens:maxOutputTokens}),signal:controller.signal});if(!response.ok)throw classifyStatus(response.status);const body=await response.json()as Record<string,unknown>,openaiRequestId=response.headers.get("x-request-id"),requestId=openaiRequestId??String(body.id??correlationId),resolvedSnapshot=typeof body.model==="string"?body.model:model,usage={...pricedUsage(body.usage,model,stage,performance.now()-started),configured_model:model,resolved_snapshot:resolvedSnapshot,openai_request_id:openaiRequestId??"unavailable",correlation_id:correlationId};if(Number(usage.calculated_cost_usd??0)>GUIDEBOOK_COST_CEILING_USD)throw new CreationProviderError("terminal","The guidebook cost ceiling was exceeded.",false,response.status,usage,requestId);if(body.status==="incomplete"){const details=body.incomplete_details as Record<string,unknown>|undefined,reason=details?.reason;throw new CreationProviderError("invalid_output","The creation provider returned an incomplete result.",reason==="max_output_tokens",response.status,usage,requestId)}const text=responseText(body);if(!text)throw new CreationProviderError("invalid_output","The creation provider returned an invalid result.",false,response.status,usage,requestId);return{text,requestId,httpStatus:response.status,openaiRequestId,model:resolvedSnapshot,usage}}catch(error){if(error instanceof CreationProviderError)throw error;if(controller.signal.aborted)throw new CreationProviderError("timeout","The creation provider timed out.",true);throw new CreationProviderError("unavailable","The creation provider is unavailable.",true)}finally{clearTimeout(timeout);outerSignal.removeEventListener("abort",abort)}
  }
}

type GatewayConfig=Readonly<{token:string;model:string;timeoutMs:number}>;
export class VercelAiGatewayCreationProvider implements ExtractionProvider,GenerationProvider{
  readonly key:string;
  constructor(private readonly config:GatewayConfig,private readonly fetcher:typeof fetch=fetch){this.key=`vercel-ai-gateway.responses.v1:${config.model}`}
  async extract(input:Parameters<ExtractionProvider["extract"]>[0]){
    const content:Record<string,unknown>[]=[{type:"input_text",text:extractionInstruction(input.sources)}];
    for(const source of input.sources){const data=Buffer.from(source.bytes).toString("base64"),url=`data:${source.mediaType};base64,${data}`;content.push(source.sourceType==="image"?{type:"input_image",image_url:url,detail:"high"}:{type:"input_file",filename:source.originalFilename,file_data:url})}
    const output=await this.request(content,input.correlationId,input.signal,"guidebook_extraction");
    return{result:this.parse(output.text,extractionResultSchema),requestId:output.requestId,usage:output.usage};
  }
  async generate(input:Parameters<GenerationProvider["generate"]>[0]){
    const safeFacts=input.facts.map(f=>({id:f.id,category:f.category,field:f.field,value:f.correctedValue??f.normalizedValue,sourceId:f.sourceId}));
    const text=["Create one guidebook draft proposal as JSON. Use only supplied confirmed facts. Never invent operational information.",`Template version: ${input.templateVersionId}`,`Allowed components: ${JSON.stringify(Object.fromEntries(input.allowedComponents))}`,`Presentation instructions: ${JSON.stringify(input.instructions)}`,`Confirmed facts: ${JSON.stringify(safeFacts)}`].join("\n");
    const output=await this.request([{type:"input_text",text}],input.correlationId,input.signal,"guidebook_proposal");
    return{proposal:this.parse(output.text,guidebookProposalSchema),requestId:output.requestId,usage:output.usage};
  }
  private parse<T>(text:string,schema:{parse(value:unknown):T}){try{return schema.parse(JSON.parse(text))}catch{throw new CreationProviderError("invalid_output","The creation provider returned an invalid result.",false)}}
  private async request(content:Record<string,unknown>[],correlationId:string,outerSignal:AbortSignal,schemaName:string){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),this.config.timeoutMs),abort=()=>controller.abort();outerSignal.addEventListener("abort",abort,{once:true});try{const response=await this.fetcher(GATEWAY_ENDPOINT,{method:"POST",headers:{authorization:`Bearer ${this.config.token}`,"content-type":"application/json","x-correlation-id":correlationId},body:JSON.stringify({model:this.config.model,store:false,input:[{role:"user",content}],text:{format:{type:"json_object"}},reasoning:{effort:"low"},max_output_tokens:16000}),signal:controller.signal});if(!response.ok)throw classifyStatus(response.status);const body=await response.json()as Record<string,unknown>,text=responseText(body);if(!text)throw new CreationProviderError("invalid_output","The creation provider returned an invalid result.",false);return{text,requestId:String(body.id??correlationId),usage:safeUsage(body.usage),schemaName}}catch(error){if(error instanceof CreationProviderError)throw error;if(controller.signal.aborted)throw new CreationProviderError("timeout","The creation provider timed out.",true);throw new CreationProviderError("unavailable","The creation provider is unavailable.",true)}finally{clearTimeout(timeout);outerSignal.removeEventListener("abort",abort)}}
}

function extractionInstruction(sources:readonly ProviderSource[]){return["Extract structured guidebook facts from the attached controlled sources. Return JSON with facts, missing, warnings, mediaCandidates, and unsupported.","Do not invent facts or silently resolve conflicts. Known access, Wi-Fi, safety, parking, occupancy, policy, and checkout facts are high risk. Never return permanent secret values: use null and needs_review.",`Sources in attachment order: ${JSON.stringify(sources.map(s=>({id:s.id,type:s.sourceType,filename:s.originalFilename})))}`].join("\n")}
function responseText(body:Record<string,unknown>){if(typeof body.output_text==="string")return body.output_text;const output=Array.isArray(body.output)?body.output:[];for(const item of output){if(!item||typeof item!=="object")continue;for(const part of Array.isArray((item as Record<string,unknown>).content)?(item as Record<string,unknown>).content as unknown[]:[]){if(part&&typeof part==="object"&&typeof(part as Record<string,unknown>).text==="string")return String((part as Record<string,unknown>).text)}}return""}
function safeUsage(value:unknown){if(!value||typeof value!=="object")return undefined;const v=value as Record<string,unknown>,usage:Record<string,number>={};for(const key of["input_tokens","output_tokens","total_tokens"]){if(typeof v[key]==="number"&&Number.isFinite(v[key]))usage[key]=v[key]}return Object.keys(usage).length?usage:undefined}
function classifyStatus(status:number){const retryable=status===408||status===409||status===429||status>=500;return new CreationProviderError(status===429?"rate_limit":retryable?"unavailable":"terminal","The creation provider could not complete the request.",retryable,status)}
function parseResponse<T>(text:string,schema:{parse(value:unknown):T}){try{return schema.parse(JSON.parse(text))}catch{throw new CreationProviderError("invalid_output","The creation provider returned an invalid result.",false)}}
function strictJsonSchema(schema:z.ZodType){const root=z.toJSONSchema(schema)as Record<string,unknown>;delete root.$schema;const visit=(value:unknown)=>{if(!value||typeof value!=="object")return;const record=value as Record<string,unknown>,properties=record.properties;if(properties&&typeof properties==="object"&&!Array.isArray(properties)){record.additionalProperties=false;record.required=Object.keys(properties as Record<string,unknown>)}for(const child of Object.values(record))if(Array.isArray(child))child.forEach(visit);else visit(child)};visit(root);return root}
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
  if(process.env.GUIDEBOOK_CREATION_ADAPTER==="vercel-ai-gateway"){
    const token=process.env.AI_GATEWAY_API_KEY??process.env.VERCEL_OIDC_TOKEN,model=process.env.GUIDEBOOK_CREATION_PROVIDER_MODEL;
    if(!token||model!==CREATION_PROVIDER_CANDIDATE)return null;
    return new VercelAiGatewayCreationProvider({token,model,timeoutMs:timeout});
  }
  return null;
}

export function controlledVerificationProviderFromEnvironment(){
  if(process.env.CONTROLLED_GUIDEBOOK_JOURNEY_ENABLED!=="true"||process.env.CONTROLLED_GUIDEBOOK_JOURNEY_KILL_SWITCH==="true")return null;
  const timeout=Number(process.env.GUIDEBOOK_CREATION_PROVIDER_TIMEOUT_MS??"60000"),apiKey=process.env.OPENAI_API_KEY,projectId=process.env.OPENAI_PROJECT_ID,extractionModel=process.env.GUIDEBOOK_CREATION_EXTRACTION_MODEL??OPENAI_EXTRACTION_MODEL,generationModel=process.env.GUIDEBOOK_CREATION_GENERATION_MODEL??OPENAI_GENERATION_MODEL;
  if(!Number.isInteger(timeout)||timeout<5000||timeout>120000||!apiKey||!projectId||extractionModel!==OPENAI_EXTRACTION_MODEL||generationModel!==OPENAI_GENERATION_MODEL||process.env.GUIDEBOOK_CREATION_ALLOW_GPT54_FALLBACK==="true")return null;
  return new DirectOpenAiCreationProvider({apiKey,projectId,extractionModel,generationModel,timeoutMs:timeout,allowExplicitFallback:false});
}
