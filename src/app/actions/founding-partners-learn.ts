"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionSchema,day90ReviewSchema,feedbackSchema,monthlyReviewSchema,opportunitySchema,outcomeSchema } from "@/features/founding-partners/application";
import { OPPORTUNITY_STATUSES } from "@/features/founding-partners/learn";

function revalidateProgram(programId:string){revalidatePath("/admin/customers");revalidatePath(`/admin/customers/programs/${programId}`);}

export async function saveFoundingOpportunity(form:FormData){
  const {user}=await requireRole(["admin"]),v=opportunitySchema.parse(Object.fromEntries(form.entries())),db=createAdminClient(),now=new Date().toISOString();
  const row={customer_program_id:v.programId,pillar:v.pillar||null,title:v.title,evidence:v.evidence??"",why_it_matters:v.whyItMatters??"",estimated_impact:v.estimatedImpact??"",confidence:v.confidence,recommended_action:v.recommendedAction??"",status:v.status,source_lineage:v.sourceLineage??"",updated_at:now};
  const {error}=v.opportunityId
    ?await db.from("founding_partner_opportunities").update(row).eq("id",v.opportunityId).eq("customer_program_id",v.programId)
    :await db.from("founding_partner_opportunities").insert({...row,created_by:user.id});
  if(error)throw new Error("FP001_OPPORTUNITY_SAVE_FAILED");
  await db.from("customer_program_audit_events").insert({customer_program_id:v.programId,event_type:v.opportunityId?"opportunity_updated":"opportunity_created",actor_id:user.id,safe_metadata:{title:v.title,status:v.status}});
  revalidateProgram(v.programId);
}
export async function updateFoundingOpportunityStatus(form:FormData){
  const {user}=await requireRole(["admin"]),programId=String(form.get("programId")),opportunityId=String(form.get("opportunityId")),status=String(form.get("status")),db=createAdminClient();
  if(!OPPORTUNITY_STATUSES.includes(status as (typeof OPPORTUNITY_STATUSES)[number]))throw new Error("FP001_OPPORTUNITY_STATUS_INVALID");
  const {error}=await db.from("founding_partner_opportunities").update({status,updated_at:new Date().toISOString()}).eq("id",opportunityId).eq("customer_program_id",programId);
  if(error)throw new Error("FP001_OPPORTUNITY_STATUS_SAVE_FAILED");
  await db.from("customer_program_audit_events").insert({customer_program_id:programId,event_type:"opportunity_status_changed",actor_id:user.id,safe_metadata:{opportunityId,status}});
  revalidateProgram(programId);
}
export async function saveFoundingAction(form:FormData){
  const {user}=await requireRole(["admin"]),v=actionSchema.parse(Object.fromEntries(form.entries())),db=createAdminClient();
  const {error}=await db.from("founding_partner_actions").insert({customer_program_id:v.programId,opportunity_id:v.opportunityId||null,decision:v.decision,action_description:v.actionDescription??"",owner:v.owner??"",target_date:v.targetDate||null,status:v.status,created_by:user.id});
  if(error)throw new Error("FP001_ACTION_SAVE_FAILED");
  await db.from("customer_program_audit_events").insert({customer_program_id:v.programId,event_type:"action_created",actor_id:user.id,safe_metadata:{decision:v.decision}});
  revalidateProgram(v.programId);
}
export async function saveFoundingOutcome(form:FormData){
  const {user}=await requireRole(["admin"]),v=outcomeSchema.parse(Object.fromEntries(form.entries())),db=createAdminClient(),now=new Date().toISOString();
  const {error}=await db.from("founding_partner_outcomes").upsert({action_id:v.actionId,customer_program_id:v.programId,status:v.status,estimated_value:v.estimatedValue??"",realized_value:v.realizedValue??"",notes:v.notes??"",measured_by:user.id,measured_at:now,updated_at:now},{onConflict:"action_id"});
  if(error)throw new Error("FP001_OUTCOME_SAVE_FAILED");
  await db.from("customer_program_audit_events").insert({customer_program_id:v.programId,event_type:"outcome_saved",actor_id:user.id,safe_metadata:{actionId:v.actionId,status:v.status}});
  revalidateProgram(v.programId);
}
export async function saveFoundingMonthlyReview(form:FormData){
  const {user}=await requireRole(["admin"]),v=monthlyReviewSchema.parse(Object.fromEntries(form.entries())),db=createAdminClient();
  const {error}=await db.from("founding_partner_monthly_reviews").insert({customer_program_id:v.programId,review_month:v.reviewMonth,summary:v.summary,wins:v.wins??"",challenges:v.challenges??"",next_focus:v.nextFocus??"",reviewed_by:user.id});
  if(error)throw new Error("FP001_MONTHLY_REVIEW_SAVE_FAILED");
  await db.from("founding_partner_events").insert({event_name:"founding_partner_review_completed",customer_program_id:v.programId,safe_context:{reviewMonth:v.reviewMonth}});
  await db.from("customer_program_audit_events").insert({customer_program_id:v.programId,event_type:"monthly_review_completed",actor_id:user.id,safe_metadata:{reviewMonth:v.reviewMonth}});
  revalidateProgram(v.programId);
}
export async function saveFoundingFeedback(form:FormData){
  const {user}=await requireRole(["admin"]),v=feedbackSchema.parse(Object.fromEntries(form.entries())),db=createAdminClient();
  const {error}=await db.from("founding_partner_feedback").insert({customer_program_id:v.programId,feedback_type:v.feedbackType,signal_maturity:v.signalMaturity,summary:v.summary,detail:v.detail??"",captured_by:user.id});
  if(error)throw new Error("FP001_FEEDBACK_SAVE_FAILED");
  await db.from("customer_program_audit_events").insert({customer_program_id:v.programId,event_type:"feedback_captured",actor_id:user.id,safe_metadata:{feedbackType:v.feedbackType,signalMaturity:v.signalMaturity}});
  revalidateProgram(v.programId);
}
export async function saveFoundingDay90Review(form:FormData){
  const {user}=await requireRole(["admin"]),v=day90ReviewSchema.parse(Object.fromEntries(form.entries())),db=createAdminClient(),now=new Date().toISOString();
  const {error}=await db.from("founding_partner_day90_reviews").insert({customer_program_id:v.programId,value_delivered:v.valueDelivered??"",would_pay:v.wouldPay==="yes"?true:v.wouldPay==="no"?false:null,willingness_to_pay_notes:v.willingnessToPayNotes??"",testimonial_capture:v.testimonialCapture??"",recommended_next_step:v.recommendedNextStep,rationale:v.rationale,conducted_by:user.id});
  if(error)throw new Error("FP001_DAY90_REVIEW_SAVE_FAILED");
  await db.from("founding_partner_events").insert({event_name:"founding_partner_day90_completed",customer_program_id:v.programId,safe_context:{recommendedNextStep:v.recommendedNextStep}});
  const {data:program}=await db.from("customer_programs").select("customer_account_id,target_end_at").eq("id",v.programId).single();
  if(program){
    if(v.recommendedNextStep==="convert"){
      await db.from("customer_programs").update({program_status:"completed",next_action:"Transition to commercial relationship",updated_at:now}).eq("id",v.programId);
      await db.from("customer_accounts").update({lifecycle_stage:"converted",updated_at:now}).eq("id",program.customer_account_id);
      await db.from("founding_partner_events").insert({event_name:"founding_partner_converted",customer_program_id:v.programId,safe_context:{}});
    }else if(v.recommendedNextStep==="exit"){
      await db.from("customer_programs").update({program_status:"exited",next_action:"Closed",updated_at:now}).eq("id",v.programId);
      await db.from("customer_accounts").update({lifecycle_stage:"exited",updated_at:now}).eq("id",program.customer_account_id);
      await db.from("founding_partner_events").insert({event_name:"founding_partner_exited",customer_program_id:v.programId,safe_context:{}});
    }else{
      const extended=new Date(new Date(program.target_end_at??now).getTime()+90*86400000).toISOString();
      await db.from("customer_programs").update({target_end_at:extended,next_action:"Extended design partnership",updated_at:now}).eq("id",v.programId);
    }
  }
  await db.from("customer_program_audit_events").insert({customer_program_id:v.programId,event_type:"day90_review_completed",actor_id:user.id,safe_metadata:{recommendedNextStep:v.recommendedNextStep}});
  revalidateProgram(v.programId);
}
