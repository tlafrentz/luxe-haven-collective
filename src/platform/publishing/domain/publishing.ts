export type PublishingStage="queued"|"validating"|"snapshotting"|"rendering"|"activating"|"completed";
export type PublishingStatus="queued"|"processing"|"completed"|"failed"|"cancelled";
export type ValidationSeverity="error"|"warning"|"recommendation";
export type PublishingValidationIssue=Readonly<{code:string;severity:ValidationSeverity;message:string;recovery?:string;field?:string}>;
export type PublishingValidationResult=Readonly<{status:"ready"|"warnings"|"blocked";issues:readonly PublishingValidationIssue[];validatedAt:string;validatorVersion:string}>;
export type PublishingCommand=Readonly<{commandId:string;subjectType:string;subjectId:string;workspaceId:string;actorId:string;expectedRevision:number;notes?:string;warningOverride:boolean;requestedAt:string}>;
export type PublishingJob=Readonly<{id:string;command:PublishingCommand;status:PublishingStatus;stage:PublishingStage;attempts:number;failureCode?:string;failureMessage?:string;retryable?:boolean;createdAt:string;completedAt?:string}>;

export interface PublishingAdapter<TSource,TSnapshot,TResult>{
 load(command:PublishingCommand):Promise<TSource>;
 validate(source:TSource,command:PublishingCommand):Promise<PublishingValidationResult>|PublishingValidationResult;
 snapshot(source:TSource,command:PublishingCommand):Promise<TSnapshot>|TSnapshot;
 render?(snapshot:TSnapshot,command:PublishingCommand):Promise<TSnapshot>;
 activate(snapshot:TSnapshot,command:PublishingCommand):Promise<TResult>;
 refresh(result:TResult,command:PublishingCommand):Promise<void>;
}
export interface PublishingLifecycle{stage(stage:PublishingStage,validation?:PublishingValidationResult):Promise<void>;complete():Promise<void>;fail(code:string,message:string,retryable:boolean):Promise<void>}
export class PlatformPublishingEngine{
 async execute<TSource,TSnapshot,TResult>(command:PublishingCommand,adapter:PublishingAdapter<TSource,TSnapshot,TResult>,lifecycle:PublishingLifecycle){
  try{await lifecycle.stage("validating");const source=await adapter.load(command),validation=await adapter.validate(source,command);await lifecycle.stage("validating",validation);if(validation.status==="blocked")throw new PublishingFailure("validation_failed","Resolve blocking validation errors before publishing.",false);if(validation.status==="warnings"&&!command.warningOverride)throw new PublishingFailure("warning_confirmation_required","Confirm the publishing warnings before continuing.",false);await lifecycle.stage("snapshotting");let snapshot=await adapter.snapshot(source,command);if(adapter.render){await lifecycle.stage("rendering");snapshot=await adapter.render(snapshot,command)}await lifecycle.stage("activating");const result=await adapter.activate(snapshot,command);await adapter.refresh(result,command);await lifecycle.stage("completed");await lifecycle.complete();return Object.freeze({ok:true as const,result,validation});}
  catch(error){const failure=error instanceof PublishingFailure?error:new PublishingFailure("publishing_failed","Publishing failed before activation. The previous artifact remains active.",true);await lifecycle.fail(failure.code,failure.message,failure.retryable);return Object.freeze({ok:false as const,failure});}
 }
}
export class PublishingFailure extends Error{constructor(public readonly code:string,message:string,public readonly retryable:boolean){super(message);this.name="PublishingFailure";Object.freeze(this)}}
export function createPublishingValidation(issues:readonly PublishingValidationIssue[],validatedAt=new Date().toISOString(),validatorVersion="platform-publishing-validator.v1"):PublishingValidationResult{const status=issues.some(issue=>issue.severity==="error")?"blocked":issues.some(issue=>issue.severity==="warning")?"warnings":"ready";return deepFreeze({status,issues:[...issues],validatedAt,validatorVersion});}
function deepFreeze<T>(value:T):T{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(deepFreeze)}return value;}
