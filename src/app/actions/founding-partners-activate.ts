"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { baselinePillarSchema, dataConnectionSchema, foundingPartnerPropertySchema } from "@/features/founding-partners/application";
import { HPM_PILLARS } from "@/features/founding-partners/activate";

type AdminDb=ReturnType<typeof createAdminClient>;
async function fireEventOnce(db:AdminDb,programId:string,eventName:string){
  const {data:existing}=await db.from("founding_partner_events").select("id").eq("customer_program_id",programId).eq("event_name",eventName).limit(1).maybeSingle();
  if(existing)return;
  await db.from("founding_partner_events").insert({event_name:eventName,customer_program_id:programId,safe_context:{}});
  await db.from("customer_program_audit_events").insert({customer_program_id:programId,event_type:eventName,safe_metadata:{}});
}
async function advanceProgramToOnboarding(db:AdminDb,programId:string){
  const now=new Date().toISOString(),{data:program}=await db.from("customer_programs").select("program_status,customer_account_id").eq("id",programId).single();
  if(!program||program.program_status!=="accepted")return;
  await db.from("customer_programs").update({program_status:"onboarding",next_action:"Complete onboarding",updated_at:now}).eq("id",programId);
  await db.from("customer_accounts").update({lifecycle_stage:"onboarding",updated_at:now}).eq("id",program.customer_account_id);
}
async function checkOnboardingCompletion(db:AdminDb,programId:string){
  const [{count:propertyCount},{data:connections},{data:pillars}]=await Promise.all([
    db.from("founding_partner_properties").select("id",{count:"exact",head:true}).eq("customer_program_id",programId),
    db.from("founding_partner_data_connections").select("source_type").eq("customer_program_id",programId),
    db.from("founding_partner_baseline").select("pillar").eq("customer_program_id",programId),
  ]);
  if((propertyCount??0)>0&&(connections?.length??0)>=4)await fireEventOnce(db,programId,"founding_partner_onboarding_completed");
  if((pillars?.length??0)>=HPM_PILLARS.length){
    await fireEventOnce(db,programId,"founding_partner_baseline_completed");
    const now=new Date().toISOString(),{data:program}=await db.from("customer_programs").select("program_status,customer_account_id").eq("id",programId).single();
    if(program&&!["active","completed","exited"].includes(program.program_status)){
      await db.from("customer_programs").update({program_status:"active",next_action:"Begin value delivery",updated_at:now}).eq("id",programId);
      await db.from("customer_accounts").update({lifecycle_stage:"active",updated_at:now}).eq("id",program.customer_account_id);
    }
  }
}
function revalidateProgram(programId:string){revalidatePath("/admin/customers");revalidatePath(`/admin/customers/programs/${programId}`);}

export async function addFoundingPartnerProperty(form:FormData){
  await requireRole(["admin"]);
  const v=foundingPartnerPropertySchema.parse(Object.fromEntries(form.entries())),db=createAdminClient();
  const {error}=await db.from("founding_partner_properties").insert({customer_program_id:v.programId,name:v.name,address:v.address||null,property_type:v.propertyType||null,unit_count:v.unitCount??null,notes:v.notes??""});
  if(error)throw new Error("FP001_PROPERTY_SAVE_FAILED");
  await advanceProgramToOnboarding(db,v.programId);
  await checkOnboardingCompletion(db,v.programId);
  await db.from("customer_program_audit_events").insert({customer_program_id:v.programId,event_type:"property_added",safe_metadata:{name:v.name}});
  revalidateProgram(v.programId);
}
export async function deleteFoundingPartnerProperty(form:FormData){
  const {user}=await requireRole(["admin"]),propertyId=String(form.get("propertyId")),programId=String(form.get("programId")),db=createAdminClient();
  const {error}=await db.from("founding_partner_properties").delete().eq("id",propertyId).eq("customer_program_id",programId);
  if(error)throw new Error("FP001_PROPERTY_DELETE_FAILED");
  await db.from("customer_program_audit_events").insert({customer_program_id:programId,event_type:"property_removed",actor_id:user.id,safe_metadata:{propertyId}});
  revalidateProgram(programId);
}
export async function saveFoundingDataConnection(form:FormData){
  const {user}=await requireRole(["admin"]),v=dataConnectionSchema.parse(Object.fromEntries(form.entries())),db=createAdminClient(),now=new Date().toISOString();
  const {error}=await db.from("founding_partner_data_connections").upsert({customer_program_id:v.programId,source_type:v.sourceType,status:v.status,notes:v.notes??"",updated_by:user.id,updated_at:now},{onConflict:"customer_program_id,source_type"});
  if(error)throw new Error("FP001_DATA_CONNECTION_SAVE_FAILED");
  await advanceProgramToOnboarding(db,v.programId);
  await checkOnboardingCompletion(db,v.programId);
  await db.from("customer_program_audit_events").insert({customer_program_id:v.programId,event_type:"data_connection_updated",actor_id:user.id,safe_metadata:{sourceType:v.sourceType,status:v.status}});
  revalidateProgram(v.programId);
}
export async function saveFoundingBaselinePillar(form:FormData){
  const {user}=await requireRole(["admin"]),v=baselinePillarSchema.parse(Object.fromEntries(form.entries())),db=createAdminClient(),now=new Date().toISOString();
  const {error}=await db.from("founding_partner_baseline").upsert({customer_program_id:v.programId,pillar:v.pillar,status:v.status,data_completeness_percent:v.dataCompletenessPercent,notes:v.notes??"",assessed_by:user.id,assessed_at:now},{onConflict:"customer_program_id,pillar"});
  if(error)throw new Error("FP001_BASELINE_SAVE_FAILED");
  await advanceProgramToOnboarding(db,v.programId);
  await checkOnboardingCompletion(db,v.programId);
  await db.from("customer_program_audit_events").insert({customer_program_id:v.programId,event_type:"baseline_pillar_updated",actor_id:user.id,safe_metadata:{pillar:v.pillar,status:v.status}});
  revalidateProgram(v.programId);
}
