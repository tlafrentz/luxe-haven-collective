import { extractionResultSchema,guidebookProposalSchema,type CreationSource,type ExtractedFact,type ExtractionResult,type GuidebookProposal } from "./domain";

export type ProviderFailureKind="timeout"|"rate_limit"|"unavailable"|"invalid_output"|"terminal";
export class CreationProviderError extends Error{constructor(public readonly kind:ProviderFailureKind,message:string,public readonly retryable:boolean){super(message);this.name="CreationProviderError"}}
export type ProviderSource=CreationSource&Readonly<{bytes:Uint8Array}>;
export interface ExtractionProvider{readonly key:string;extract(input:Readonly<{sources:readonly ProviderSource[];correlationId:string;signal:AbortSignal}>):Promise<Readonly<{result:ExtractionResult;requestId:string;usage?:Readonly<Record<string,number>>}>>}
export interface GenerationProvider{readonly key:string;generate(input:Readonly<{facts:readonly ExtractedFact[];templateVersionId:string;allowedComponents:ReadonlyMap<string,string>;instructions:Readonly<Record<string,string|boolean>>;correlationId:string;signal:AbortSignal}>):Promise<Readonly<{proposal:GuidebookProposal;requestId:string;usage?:Readonly<Record<string,number>>}>>}

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
export const CREATION_PROVIDER_CANDIDATE="openai/gpt-5.4-mini-2026-03-17";

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
function classifyStatus(status:number){const retryable=status===408||status===409||status===429||status>=500;return new CreationProviderError(status===429?"rate_limit":retryable?"unavailable":"terminal","The creation provider could not complete the request.",retryable)}

export function productionProviderFromEnvironment(){
  if(process.env.GUIDEBOOK_CREATION_KILL_SWITCH==="true")return null;
  if(process.env.GUIDEBOOK_CREATION_ADAPTER!=="vercel-ai-gateway")return null;
  const token=process.env.AI_GATEWAY_API_KEY??process.env.VERCEL_OIDC_TOKEN,model=process.env.GUIDEBOOK_CREATION_PROVIDER_MODEL;
  const timeout=Number(process.env.GUIDEBOOK_CREATION_PROVIDER_TIMEOUT_MS??"60000");
  if(!token||model!==CREATION_PROVIDER_CANDIDATE||!Number.isInteger(timeout)||timeout<5000||timeout>120000)return null;
  return new VercelAiGatewayCreationProvider({token,model,timeoutMs:timeout});
}
