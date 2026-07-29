"use server";
import{revalidatePath}from"next/cache";import{redirect}from"next/navigation";import{z}from"zod";
import{beginCanonicalLearningReview,scheduleCanonicalLearningReview,validateCanonicalLearning,SupabaseCanonicalLearningRepository,type CanonicalLearningCandidate}from"@/platform/learning";
import{evaluateWorkspacePermission,resolveWorkspaceAccessContext,SupabaseTeamAccessRepository}from"@/features/workspace";
import{getSessionProfile}from"@/lib/auth/session";import{createClient}from"@/lib/supabase/server";
const schema=z.object({workspaceId:z.string().uuid(),candidateId:z.string().min(1),futureGuidance:z.string().trim().min(10).max(2000)});
export async function validateCanonicalLearningCandidateAction(formData:FormData){
  const correlationId=crypto.randomUUID(),parsed=schema.safeParse(Object.fromEntries(formData));
  if(!parsed.success)redirect(`/dashboard/learning/candidates?error=invalid&correlation=${correlationId}`);
  const{user}=await getSessionProfile();if(!user)redirect(`/login?next=/dashboard/learning/candidates`);
  const input=parsed.data,access=await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(),user.id,input.workspaceId);
  if(!evaluateWorkspacePermission(access,"learning.lessons.publish"))redirect(`/dashboard/learning/candidates?error=permission&correlation=${correlationId}`);
  try{
    const{data,error}=await(await createClient()).from("canonical_learning_candidates").select("*").eq("workspace_id",access.workspaceId).eq("id",input.candidateId).maybeSingle();
    if(error||!data)redirect(`/dashboard/learning/candidates?error=not-found&correlation=${correlationId}`);
    const row=data as Record<string,unknown>,candidate:CanonicalLearningCandidate={id:String(row.id),workspaceId:String(row.workspace_id),seriesId:String(row.series_id),category:row.category as CanonicalLearningCandidate["category"],statement:String(row.statement),applicability:row.applicability as CanonicalLearningCandidate["applicability"],lineage:row.lineage as CanonicalLearningCandidate["lineage"],confidence:row.confidence as CanonicalLearningCandidate["confidence"],validationStatus:row.validation_status as CanonicalLearningCandidate["validationStatus"],createdAt:String(row.created_at),policyVersion:"learning-candidate.v1"};
    const now=new Date().toISOString(),review=beginCanonicalLearningReview(scheduleCanonicalLearningReview(candidate,{id:`learning-review:${candidate.id}`,scheduledAt:now,reviewerProfileId:user.id}),user.id);
    const learning=validateCanonicalLearning(candidate,review,{id:`validated-learning:${candidate.seriesId}:v1`,futureGuidance:input.futureGuidance,reviewerProfileId:user.id,validatedAt:now});
    const repository=new SupabaseCanonicalLearningRepository();await repository.appendReview(review);await repository.appendValidatedLearning(learning);
    console.info("canonical_learning_validated",{correlationId,capability:"learning-intelligence",operation:"validate-learning",workspaceId:access.workspaceId,candidateId:candidate.id,learningId:learning.id,version:learning.version,timestamp:now});
    revalidatePath("/dashboard/learning");revalidatePath("/dashboard/learning/candidates");revalidatePath("/dashboard/learning/lessons");
  }catch(error){console.error("capability_operation_failed",{correlationId,capability:"learning-intelligence",operation:"validate-learning",code:"LEARNING_VALIDATION_FAILED",workspaceId:access.workspaceId,retryable:true,timestamp:new Date().toISOString(),errorType:error instanceof Error?error.name:"unknown"});redirect(`/dashboard/learning/candidates?error=failed&correlation=${correlationId}`)}
  redirect("/dashboard/learning/candidates?validated=true");
}
