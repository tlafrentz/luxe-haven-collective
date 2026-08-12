import { createHash } from "node:crypto";
import { CA001F_PLAN, VERIFICATION_SCENARIOS } from "../domain/registry";
import { ProductionReleaseCandidate, ProductionVerificationError, ProductionVerificationRun } from "../domain";

export interface VerificationCoordinationAuthorization { authorize(actorId:string, operation:"candidate.lock"|"run.create"):Promise<boolean>; }
export interface ReleaseCandidateRepository { find(commitSha:string,deploymentId:string):Promise<ProductionReleaseCandidate|null>; create(value:Omit<ProductionReleaseCandidate,"id"|"createdAt">,actorId:string,correlationId:string):Promise<ProductionReleaseCandidate>; }
export interface VerificationRunRepository { findActive(candidateId:string,planCode:string,planVersion:number):Promise<ProductionVerificationRun|null>; create(input:{candidateId:string;actorId:string;reviewerId:string;correlationId:string;instances:readonly {scenarioCode:string;scenarioVersion:number;expectedOutcomeCode:string}[]}):Promise<ProductionVerificationRun>; }

export function safeConfigurationFingerprint(value:Readonly<Record<string,string|number|boolean>>) { return createHash("sha256").update(JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)))).digest("hex"); }

export class LockProductionReleaseCandidate {
  constructor(private authorization:VerificationCoordinationAuthorization,private repository:ReleaseCandidateRepository){}
  async execute(input:{actorId:string;correlationId:string;candidate:Omit<ProductionReleaseCandidate,"id"|"createdAt">}){
    if(!await this.authorization.authorize(input.actorId,"candidate.lock"))throw new ProductionVerificationError("CANDIDATE_LOCK_NOT_AUTHORIZED");
    if(input.candidate.environmentCode!=="production"||input.candidate.verificationPlanVersion!==CA001F_PLAN.version)throw new ProductionVerificationError("CANDIDATE_CONFIGURATION_INVALID");
    const existing=await this.repository.find(input.candidate.commitSha,input.candidate.deploymentId);if(existing)return existing;
    return this.repository.create(input.candidate,input.actorId,input.correlationId);
  }
}

export class CreateProductionVerificationRun {
  constructor(private authorization:VerificationCoordinationAuthorization,private repository:VerificationRunRepository){}
  async execute(input:{actorId:string;reviewerId:string;candidate:ProductionReleaseCandidate;correlationId:string}){
    if(!await this.authorization.authorize(input.actorId,"run.create"))throw new ProductionVerificationError("RUN_CREATION_NOT_AUTHORIZED");
    if(input.actorId===input.reviewerId)throw new ProductionVerificationError("REVIEWER_SEPARATION_REQUIRED");
    const existing=await this.repository.findActive(input.candidate.id,CA001F_PLAN.code,CA001F_PLAN.version);if(existing)return existing;
    return this.repository.create({candidateId:input.candidate.id,actorId:input.actorId,reviewerId:input.reviewerId,correlationId:input.correlationId,instances:VERIFICATION_SCENARIOS.map(({code,version,expectedOutcomeCode})=>({scenarioCode:code,scenarioVersion:version,expectedOutcomeCode}))});
  }
}
