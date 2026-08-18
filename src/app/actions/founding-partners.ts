"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { discoverySchema, foundingPartnerApplicationSchema, qualificationSchema } from "@/features/founding-partners/application";

export type FoundingApplicationState={ok:boolean;message:string;fieldErrors?:Record<string,string[]>};
export async function recordFoundingPartnerEvent(eventName:"founding_partner_page_viewed"|"founding_partner_cta_clicked"|"founding_partner_application_started"){
  const {error}=await createAdminClient().from("founding_partner_events").insert({event_name:eventName,safe_context:{surface:"public_founding_partners"}});
  if(error)console.error("founding_partner.analytics.failed",{eventName,code:"FP001_ANALYTICS_WRITE_FAILED"});
}
export async function submitFoundingPartnerApplication(_:FoundingApplicationState,form:FormData):Promise<FoundingApplicationState>{
  const parsed=foundingPartnerApplicationSchema.safeParse(Object.fromEntries(form.entries()));
  if(!parsed.success)return{ok:false,message:"Please complete the highlighted fields.",fieldErrors:parsed.error.flatten().fieldErrors};
  const value=parsed.data,db=createAdminClient();
  const {error}=await db.rpc("submit_founding_partner_application",{p_application:{first_name:value.firstName,last_name:value.lastName,email:value.email,business_name:value.businessName,operating_model:value.operatingModel,property_count:value.propertyCount,years_operating:value.yearsOperating,primary_markets:value.primaryMarkets,twelve_month_goal:value.twelveMonthGoal,primary_difficulty:value.primaryDifficulty,improvement_area:value.improvementArea,monthly_feedback_consent:true,early_capability_consent:true,program_interest:value.programInterest,testimonial_consent:value.testimonialConsent==="on"}});
  if(error){console.error("founding_partner.application.failed",{code:"FP001_APPLICATION_PERSIST_FAILED"});return{ok:false,message:"We couldn't save your application. Please try again."};}
  const adminTo=process.env.CONTACT_TO_EMAIL;
  if(adminTo)await sendEmail({to:adminTo,subject:`New Founding HPM Partner application: ${value.businessName}`,html:`<p>A new Founding HPM Partner application is ready for review in Admin Customers.</p>`});
  await sendEmail({to:value.email,subject:"We received your Founding HPM Partner application",html:"<h1>This Is the Beginning of the Conversation.</h1><p>We’ll review what you’re building and what you’re trying to accomplish. If the program appears to be a strong mutual fit, we’ll reach out about next steps.</p>"});
  return{ok:true,message:"This Is the Beginning of the Conversation."};
}
export async function saveFoundingQualification(form:FormData){
  const {user}=await requireRole(["admin"]),v=qualificationSchema.parse(Object.fromEntries(form.entries())),db=createAdminClient(),now=new Date().toISOString();
  const {error}=await db.from("founding_partner_qualifications").upsert({customer_program_id:v.programId,growth_orientation:v.growthOrientation,business_seriousness:v.businessSeriousness,technology_openness:v.technologyOpenness,feedback_willingness:v.feedbackWillingness,hpm_problem_fit:v.hpmProblemFit,learning_value:v.learningValue,recommendation:v.recommendation,notes:v.notes,assessed_by:user.id,assessed_at:now},{onConflict:"customer_program_id"});if(error)throw new Error("FP001_QUALIFICATION_SAVE_FAILED");
  await db.from("customer_programs").update({program_status:"review",next_action:"Complete discovery",updated_at:now}).eq("id",v.programId);
  const {data:program}=await db.from("customer_programs").select("customer_account_id").eq("id",v.programId).single();if(program)await db.from("customer_accounts").update({lifecycle_stage:"qualified",updated_at:now}).eq("id",program.customer_account_id);
  await db.from("founding_partner_events").insert({event_name:"founding_partner_qualified",customer_program_id:v.programId,safe_context:{recommendation:v.recommendation}});
  await db.from("customer_program_audit_events").insert({customer_program_id:v.programId,event_type:"qualification_saved",actor_id:user.id,reason:v.notes,safe_metadata:{recommendation:v.recommendation}});
  revalidatePath(`/admin/customers`);revalidatePath(`/admin/customers/programs/${v.programId}`);
}
export async function saveFoundingDiscovery(form:FormData){
  const {user}=await requireRole(["admin"]),v=discoverySchema.parse(Object.fromEntries(form.entries())),db=createAdminClient(),now=new Date().toISOString();
  const {error}=await db.from("founding_partner_discovery").upsert({customer_program_id:v.programId,business_notes:v.businessNotes,performance_notes:v.performanceNotes,systems_notes:v.systemsNotes,decisions_notes:v.decisionsNotes,hpm_reaction_notes:v.hpmReactionNotes,partnership_fit_notes:v.partnershipFitNotes,twelve_month_build:v.twelveMonthBuild,information_gap_decision:v.informationGapDecision,tomorrow_question:v.tomorrowQuestion,outcome:v.outcome,rationale:v.rationale,completed_by:user.id,completed_at:now},{onConflict:"customer_program_id"});if(error)throw new Error("FP001_DISCOVERY_SAVE_FAILED");
  const status=v.outcome==="accept"?"accepted":"review",target=new Date(Date.now()+90*86400000).toISOString();await db.from("customer_programs").update({program_status:status,next_action:v.outcome==="accept"?"Begin onboarding":v.outcome==="hold"?"Revisit decision":"Close application",accepted_at:v.outcome==="accept"?now:null,started_at:v.outcome==="accept"?now:null,target_end_at:v.outcome==="accept"?target:null,partner_identifier:v.outcome==="accept"?`FHP-${v.programId.slice(0,6).toUpperCase()}`:null,updated_at:now}).eq("id",v.programId);
  const {data:program}=await db.from("customer_programs").select("customer_account_id,founding_partner_applications(email,business_name)").eq("id",v.programId).single();if(program){await db.from("customer_accounts").update({lifecycle_stage:v.outcome==="accept"?"accepted":v.outcome==="decline"?"declined":"discovery",updated_at:now}).eq("id",program.customer_account_id);const application=((program.founding_partner_applications??[])as unknown as Array<{email:string;business_name:string}>)[0];if(v.outcome==="accept"&&application)await sendEmail({to:application.email,subject:"Welcome to the Founding HPM Partner Program",html:`<h1>Welcome to the Founding HPM Partner Program.</h1><p>We’re excited to establish the performance baseline for ${application.business_name} and begin the next 90 days together.</p>`});}
  await db.from("founding_partner_events").insert({event_name:v.outcome==="accept"?"founding_partner_accepted":"founding_partner_discovery_completed",customer_program_id:v.programId,safe_context:{outcome:v.outcome}});
  await db.from("customer_program_audit_events").insert({customer_program_id:v.programId,event_type:`discovery_${v.outcome}`,actor_id:user.id,reason:v.rationale,safe_metadata:{outcome:v.outcome}});
  revalidatePath(`/admin/customers`);revalidatePath(`/admin/customers/programs/${v.programId}`);
}
