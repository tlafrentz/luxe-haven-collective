"use server";
import"server-only";
import{revalidatePath}from"next/cache";
import{createClient}from"@/lib/supabase/server";
import{createAdminClient}from"@/lib/supabase/admin";
import{getSessionProfile}from"@/lib/auth/session";
import{getLearningAdministration,requestSafeLearningRetry,type LearningAdministrationInput,type LearningCalibration,type LearningOperationalJob}from"@/platform/learning";
type Row=Record<string,unknown>;
async function admin(){const session=await getSessionProfile(),client=await createClient(),{data:isAdmin}=await client.rpc("is_admin");if(!session.user||isAdmin!==true)throw new Error("learning_permission_denied");return{user:session.user,service:createAdminClient()}}
export async function getLearningAdministrationRequest(){
 const{service}=await admin(),evaluatedAt=new Date().toISOString(),[{data:reviews},{data:lessons},{data:candidates},{data:contradictions},{data:calibrations},{data:measurementJobs},{data:governanceJobs}]=await Promise.all([
  service.from("learning_outcome_review_revisions").select("id,status,created_at,completed_at,evidence_references"),
  service.from("learning_lesson_versions").select("id,category,status,confidence,maturity,evidence_references,created_at"),
  service.from("learning_candidate_lessons").select("id,created_at").eq("status","candidate"),
  service.from("learning_lesson_relationships").select("id,contradiction_state,created_at").eq("relationship_type","contradicts"),
  service.from("learning_calibrations").select("*").order("created_at",{ascending:false}),
  service.from("learning_measurement_jobs").select("id,workspace_id,status,attempts,failure_code,created_at"),
  service.from("learning_governance_jobs").select("*").order("created_at",{ascending:false}),
 ]);
 const input:LearningAdministrationInput={reviews:(reviews??[]).map(x=>({id:x.id,status:x.status,createdAt:x.created_at,completedAt:x.completed_at??undefined,evidenceCount:array(x.evidence_references).length})),lessons:(lessons??[]).map(x=>({id:x.id,category:x.category,status:x.status,confidence:x.confidence,maturity:x.maturity,evidenceCount:array(x.evidence_references).length,createdAt:x.created_at})),candidates:(candidates??[]).map(x=>({id:x.id,createdAt:x.created_at})),contradictions:(contradictions??[]).map(x=>({id:x.id,state:x.contradiction_state,createdAt:x.created_at})),calibrations:(calibrations??[]).map(mapCalibration),measurementJobs:(measurementJobs??[]).map(x=>({id:x.id,workspaceId:x.workspace_id,status:x.status,attempts:x.attempts,failureCode:x.failure_code??undefined,createdAt:x.created_at})),governanceJobs:(governanceJobs??[]).map(mapJob),evaluatedAt};
 const projection=getLearningAdministration(input);console.info("learning_administration_evaluated",{healthScore:projection.health.score,pendingReviews:projection.queues.pendingReviews,candidateLessons:projection.queues.candidateLessons,calibrationReviews:projection.queues.calibrationReviews,contradictions:projection.queues.contradictions,failedJobs:projection.queues.failedJobs,alertCount:projection.alerts.length,policyVersion:projection.policyVersion});return projection;
}
export async function retryLearningOperationAction(formData:FormData){
 const{user,service}=await admin(),aggregateId=String(formData.get("aggregateId")??""),jobType=String(formData.get("jobType")??"")as LearningOperationalJob["type"],failureCode=String(formData.get("failureCode")??""),workspaceId=String(formData.get("workspaceId")??""),now=new Date().toISOString();
 const job:LearningOperationalJob={id:`source:${aggregateId}`,workspaceId,type:jobType,aggregateId,status:"failed",attempts:Number(formData.get("attempts")??0),failureCode,createdAt:now};
 const queued=requestSafeLearningRetry(job,{id:`governance-job:${crypto.randomUUID()}`,requestedAt:now,authorized:true,retryableCodes:["provider_unavailable","measurement_retrieval_failed","learning_concurrency_conflict","persistence_failure","calibration_processing_failed"]});
 const{error}=await service.from("learning_governance_jobs").insert({id:queued.id,workspace_id:workspaceId,job_type:jobType,aggregate_id:aggregateId,status:"queued",attempts:queued.attempts,idempotency_key:`retry:${aggregateId}:${failureCode}`,created_at:now});if(error)throw new Error(error.message);
 await service.from("learning_governance_actions").insert({id:`governance-action:${crypto.randomUUID()}`,workspace_id:workspaceId,aggregate_type:jobType==="measurement-retry"?"measurement-job":"review",aggregate_id:aggregateId,action_type:"retry",reason:"Authorized safe operational retry.",evidence_references:[],actor_profile_id:user.id,policy_version:"learning-retry-v1",idempotency_key:`retry:${aggregateId}:${failureCode}`,occurred_at:now});revalidatePath("/admin/learning/jobs");
}
function mapCalibration(x:Row):LearningCalibration{return{id:text(x,"id"),workspaceId:text(x,"workspace_id"),lessonId:text(x,"lesson_id"),lessonSeriesId:text(x,"lesson_series_id"),lessonRevision:Number(x.lesson_revision),direction:text(x,"direction")as LearningCalibration["direction"],status:text(x,"status")as LearningCalibration["status"],previousConfidence:text(x,"previous_confidence")as LearningCalibration["previousConfidence"],proposedConfidence:text(x,"proposed_confidence")as LearningCalibration["proposedConfidence"],previousMaturity:text(x,"previous_maturity")as LearningCalibration["previousMaturity"],proposedMaturity:text(x,"proposed_maturity")as LearningCalibration["proposedMaturity"],reason:text(x,"reason"),evidence:array(x.evidence_references)as LearningCalibration["evidence"],reviewedByProfileId:text(x,"reviewed_by_profile_id"),policyVersion:text(x,"policy_version"),createdAt:text(x,"created_at"),...(x.reviewed_at?{reviewedAt:text(x,"reviewed_at")}:{})}}
function mapJob(x:Row):LearningOperationalJob{return{id:text(x,"id"),workspaceId:text(x,"workspace_id"),type:text(x,"job_type")as LearningOperationalJob["type"],aggregateId:text(x,"aggregate_id"),status:text(x,"status")as LearningOperationalJob["status"],attempts:Number(x.attempts),...(x.failure_code?{failureCode:text(x,"failure_code")} :{}),createdAt:text(x,"created_at"),...(x.lease_expires_at?{leaseExpiresAt:text(x,"lease_expires_at")} :{})}}
function text(x:Row,key:string){return String(x[key]??"")}function array(x:unknown):unknown[]{return Array.isArray(x)?x:[]}
