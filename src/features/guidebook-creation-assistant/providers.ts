import { extractionResultSchema,guidebookProposalSchema,type CreationSource,type ExtractedFact,type ExtractionResult,type GuidebookProposal } from "./domain";

export type ProviderFailureKind="timeout"|"rate_limit"|"unavailable"|"invalid_output"|"terminal";
export class CreationProviderError extends Error{constructor(public readonly kind:ProviderFailureKind,message:string,public readonly retryable:boolean){super(message);this.name="CreationProviderError"}}
export interface ExtractionProvider{readonly key:string;extract(input:Readonly<{sources:readonly CreationSource[];correlationId:string;signal:AbortSignal}>):Promise<Readonly<{result:ExtractionResult;requestId:string;usage?:Readonly<Record<string,number>>}>>}
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

export function productionProviderFromEnvironment(){
  const endpoint=process.env.GUIDEBOOK_CREATION_PROVIDER_URL,apiKey=process.env.GUIDEBOOK_CREATION_PROVIDER_KEY;
  return endpoint&&apiKey?new HttpCreationProvider({endpoint,apiKey}):null;
}
