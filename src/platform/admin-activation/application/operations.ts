import { ADMIN_ACTIVATION_ACTION_REGISTRY, AdminActivationError, type ActivationAssignment, type ActivationCustomerGuidance, type ActivationInternalNote } from "../domain";
export type FirstValueProductFamily="hpm"|"guidebook"|"furnishing"|"investment_intelligence";

export interface AdminActivationAuthorization { authorize(input:Readonly<{actorId:string;tenantId:string;customerAccountId:string;roleCode:string;productFamily?:FirstValueProductFamily;journeyId?:string}>):Promise<boolean> }
export interface AdminActivationRepository { findOperation(hash:string):Promise<Readonly<{status:"completed";result:unknown}>|null>;recordOperation(input:Readonly<{hash:string;actorId:string;tenantId:string;customerAccountId:string;actionCode:string;correlationId:string;upstreamReferenceId?:string;result:unknown}>):Promise<void>;assign(input:Readonly<{assignment:ActivationAssignment;expectedRevision:number}>):Promise<ActivationAssignment>;addNote(note:ActivationInternalNote):Promise<void>;addGuidance(guidance:ActivationCustomerGuidance):Promise<void> }
export type AdminActivationOperationInput=Readonly<{actorId:string;tenantId:string;customerAccountId:string;productFamily?:FirstValueProductFamily;journeyId?:string;onboardingCaseId?:string;moduleInstanceId?:string;expectedRevision?:number;reason?:string;assignedOperatorId?:string;noteBody?:string;guidanceCode?:string;customerSafeMessage?:string;correlationId:string;idempotencyKey:string}>;
export interface AdminActivationOperationPort { execute(input:AdminActivationOperationInput):Promise<Readonly<{referenceId:string;status:string;destination?:string}>> }

export class ExecuteAdminActivationAction {
  constructor(private readonly dependencies:Readonly<{authorization:AdminActivationAuthorization;repository:AdminActivationRepository;ports:Readonly<Record<string,AdminActivationOperationPort>>;hashIdempotency:(value:string)=>Promise<string>;now?:()=>Date}>){ }
  async execute(input:Readonly<{actorId:string;roleCode:string;tenantId:string;customerAccountId:string;actionCode:string;productFamily?:FirstValueProductFamily;journeyId?:string;onboardingCaseId?:string;moduleInstanceId?:string;sourceStatus:string;expectedRevision?:number;reason?:string;assignedOperatorId?:string;noteBody?:string;guidanceCode?:string;customerSafeMessage?:string;correlationId:string;idempotencyKey?:string}>) {
    const definition=ADMIN_ACTIVATION_ACTION_REGISTRY[input.actionCode as keyof typeof ADMIN_ACTIVATION_ACTION_REGISTRY];
    if(!definition||definition.status!=="active")throw new AdminActivationError("ACTION_UNREGISTERED","The activation action is unavailable.");
    if(!definition.requiredRoleCodes.includes(input.roleCode as never)||!await this.dependencies.authorization.authorize(input))throw new AdminActivationError("NOT_AUTHORIZED","The activation action is unavailable.");
    if(input.productFamily&&!definition.supportedProductFamilies.includes(input.productFamily))throw new AdminActivationError("ACTION_UNREGISTERED","The action is unavailable for this product.");
    if(definition.requiresReason&&!input.reason?.trim())throw new AdminActivationError("REASON_REQUIRED","A reason is required.");
    if(definition.requiresExpectedRevision&&input.expectedRevision===undefined)throw new AdminActivationError("STALE_REVISION","The latest record revision is required.");
    if(!definition.permittedSourceStatuses.includes(input.sourceStatus)&&definition.code!=="OPEN_AUTHORIZED_ARTIFACT")throw new AdminActivationError("SOURCE_STATUS_INVALID","The action is unavailable in the current state.");
    const logicalKey=input.idempotencyKey??`${input.actorId}:${input.customerAccountId}:${input.actionCode}:${input.journeyId??"account"}`,hash=await this.dependencies.hashIdempotency(logicalKey),existing=await this.dependencies.repository.findOperation(hash);
    if(existing)return existing.result;
    const port=this.dependencies.ports[definition.operationCode];if(!port)throw new AdminActivationError("ACTION_UNREGISTERED","The upstream operation is unavailable.");
    let result;try{result=await port.execute({...input,idempotencyKey:logicalKey})}catch{throw new AdminActivationError("UPSTREAM_OPERATION_FAILED","The activation operation could not be completed.")}
    await this.dependencies.repository.recordOperation({hash,actorId:input.actorId,tenantId:input.tenantId,customerAccountId:input.customerAccountId,actionCode:definition.code,correlationId:input.correlationId,upstreamReferenceId:result.referenceId,result});return result;
  }
}
