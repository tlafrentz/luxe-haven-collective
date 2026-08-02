"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { evaluatePropertyAccess, evaluateWorkspacePermission, resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { financialExpenseCategories } from "@/features/financial-intelligence";

const expenseInput = z.object({
  workspaceId: z.string().uuid(),
  propertyId: z.string().uuid(),
  category: z.enum(financialExpenseCategories),
  amount: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
  basis: z.enum(["actual","forecast","scenario","budget","target"]),
  frequency: z.enum(["one-time","nightly","weekly","monthly","quarterly","annual"]),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  sourceReference: z.string().trim().max(200).optional(),
  idempotencyKey: z.string().uuid(),
});

export type FinancialExpenseActionState={ok?:boolean;code?:string;message?:string;correlationId?:string;duplicate?:boolean;duplicateKind?:"none"|"possible"|"exact"};
export async function recordFinancialExpenseAction(_previous:FinancialExpenseActionState,formData:FormData):Promise<FinancialExpenseActionState>{
  const correlationId=crypto.randomUUID(),parsed=expenseInput.safeParse(Object.fromEntries(formData));
  if(!parsed.success)return{ok:false as const,code:"INVALID_EXPENSE",message:"Review the amount, category, period, and source information.",correlationId};
  const input=parsed.data,{user}=await getSessionProfile();
  if(!user)return{ok:false as const,code:"AUTHENTICATION_REQUIRED",message:"Sign in before recording an expense.",correlationId};
  try{
    const access=await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(),user.id,input.workspaceId);
    if(!evaluateWorkspacePermission(access,"financial.administration")||!evaluatePropertyAccess(access,input.propertyId))return{ok:false as const,code:"FINANCIAL_ACCESS_DENIED",message:"Your role or property access does not permit expense entry.",correlationId};
    if(input.effectiveTo&&input.effectiveTo<input.effectiveDate)return{ok:false as const,code:"INVALID_DATE_RANGE",message:"Effective through cannot be earlier than the effective date.",correlationId};
    const client=await createClient(),amountMinor=minorUnits(input.amount);
    const{data:property}=await client.from("properties").select("id").eq("id",input.propertyId).eq("owner_id",access.workspaceId).maybeSingle();
    if(!property)return{ok:false as const,code:"PROPERTY_ACCESS_DENIED",message:"The selected property is outside the active workspace.",correlationId};
    const code=`EXP-${input.category.toUpperCase()}`,{data:account,error:accountError}=await client.from("financial_accounts").upsert({
      workspace_id:access.workspaceId,code,name:input.category.replaceAll("-"," ").replace(/\b\w/g,letter=>letter.toUpperCase()),
      category:input.category==="furniture"||input.category==="equipment"||input.category==="renovations"||input.category==="replacement-reserve"||input.category==="capital-improvements"?"capital-expense":"operating-expense",
      subcategory:input.category,active:true,
    },{onConflict:"workspace_id,code"}).select("id").single();
    if(accountError||!account)throw accountError??new Error("financial_account_unavailable");
    const normalizedReference=input.sourceReference?.trim().toLocaleLowerCase("en-US").replace(/\s+/g," ");
    if(normalizedReference){
      const{data:matches,error:matchError}=await client.from("financial_transactions").select("id,source_external_id").eq("workspace_id",access.workspaceId).eq("property_id",input.propertyId).eq("measurement",input.basis).eq("amount_minor",amountMinor).eq("effective_date",input.effectiveDate);
      if(matchError)throw matchError;
      const exact=(matches??[]).some(item=>item.source_external_id?.trim().toLocaleLowerCase("en-US").replace(/\s+/g," ")===normalizedReference);
      if(exact)return{ok:false as const,code:"EXACT_DUPLICATE",message:"An expense with the same property, basis, amount, date, and source reference already exists. Review the existing expense before proceeding.",correlationId,duplicate:true,duplicateKind:"exact"};
    }
    const evidenceIds=input.sourceReference?[`manual-source:${input.sourceReference}`]:[];
    const{error}=await client.from("financial_transactions").insert({
      workspace_id:access.workspaceId,account_id:account.id,property_id:input.propertyId,
      amount_minor:amountMinor,currency:input.currency,measurement:input.basis,
      effective_date:input.effectiveDate,effective_to:input.effectiveTo||null,frequency:input.frequency,
      posting_date:input.effectiveDate,status:"posted",
      source_provider:"manual",source_external_id:input.sourceReference||null,evidence_ids:evidenceIds,
      idempotency_key:input.idempotencyKey,created_by_profile_id:user.id,
    });
    if(error){if(error.code==="23505")return{ok:true as const,duplicate:true,duplicateKind:"none",correlationId,message:"This command was already completed; no second expense was created."};throw error;}
    console.info("financial_expense_recorded",{correlationId,capability:"financial-intelligence",operation:"record-expense",workspaceId:access.workspaceId,propertyId:input.propertyId,category:input.category,basis:input.basis,timestamp:new Date().toISOString()});
    revalidatePath("/dashboard/financial");revalidatePath("/dashboard/financial/profitability");revalidatePath("/dashboard/financial/cash-flow");revalidatePath("/dashboard");
    return{ok:true as const,duplicate:false,duplicateKind:"none",correlationId};
  }catch(error){
    console.error("capability_operation_failed",{correlationId,capability:"financial-intelligence",operation:"record-expense",code:"FINANCIAL_EXPENSE_PERSISTENCE_FAILED",retryable:true,timestamp:new Date().toISOString(),errorType:error instanceof Error?error.name:"unknown"});
    return{ok:false as const,code:"FINANCIAL_EXPENSE_PERSISTENCE_FAILED",message:"The expense was not saved. Retry, then share the correlation ID with support if it continues.",correlationId};
  }
}
const expenseUpdateInput = expenseInput.omit({ idempotencyKey: true }).extend({ expenseId: z.string().uuid() });

export async function updateFinancialExpenseAction(_previous:FinancialExpenseActionState,formData:FormData):Promise<FinancialExpenseActionState>{
  const correlationId=crypto.randomUUID(),parsed=expenseUpdateInput.safeParse(Object.fromEntries(formData));
  if(!parsed.success)return{ok:false as const,code:"INVALID_EXPENSE",message:"Review the amount, category, period, and source information.",correlationId};
  const input=parsed.data,{user}=await getSessionProfile();
  if(!user)return{ok:false as const,code:"AUTHENTICATION_REQUIRED",message:"Sign in before updating an expense.",correlationId};
  try{
    const access=await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(),user.id,input.workspaceId);
    if(!evaluateWorkspacePermission(access,"financial.administration")||!evaluatePropertyAccess(access,input.propertyId))return{ok:false as const,code:"FINANCIAL_ACCESS_DENIED",message:"Your role or property access does not permit expense edits.",correlationId};
    if(input.effectiveTo&&input.effectiveTo<input.effectiveDate)return{ok:false as const,code:"INVALID_DATE_RANGE",message:"Effective through cannot be earlier than the effective date.",correlationId};
    const client=await createClient(),amountMinor=minorUnits(input.amount);
    const{data:property}=await client.from("properties").select("id").eq("id",input.propertyId).eq("owner_id",access.workspaceId).maybeSingle();
    if(!property)return{ok:false as const,code:"PROPERTY_ACCESS_DENIED",message:"The selected property is outside the active workspace.",correlationId};
    const code=`EXP-${input.category.toUpperCase()}`,{data:account,error:accountError}=await client.from("financial_accounts").upsert({
      workspace_id:access.workspaceId,code,name:input.category.replaceAll("-"," ").replace(/\b\w/g,letter=>letter.toUpperCase()),
      category:input.category==="furniture"||input.category==="equipment"||input.category==="renovations"||input.category==="replacement-reserve"||input.category==="capital-improvements"?"capital-expense":"operating-expense",
      subcategory:input.category,active:true,
    },{onConflict:"workspace_id,code"}).select("id").single();
    if(accountError||!account)throw accountError??new Error("financial_account_unavailable");
    const evidenceIds=input.sourceReference?[`manual-source:${input.sourceReference}`]:[];
    const{error,data:updated}=await client.from("financial_transactions").update({
      account_id:account.id,property_id:input.propertyId,
      amount_minor:amountMinor,currency:input.currency,measurement:input.basis,
      effective_date:input.effectiveDate,effective_to:input.effectiveTo||null,frequency:input.frequency,
      posting_date:input.effectiveDate,
      source_external_id:input.sourceReference||null,evidence_ids:evidenceIds,
    }).eq("id",input.expenseId).eq("workspace_id",access.workspaceId).select("id").maybeSingle();
    if(error)throw error;
    if(!updated)return{ok:false as const,code:"EXPENSE_NOT_FOUND",message:"The expense could not be found in this workspace.",correlationId};
    console.info("financial_expense_updated",{correlationId,capability:"financial-intelligence",operation:"update-expense",workspaceId:access.workspaceId,propertyId:input.propertyId,expenseId:input.expenseId,category:input.category,basis:input.basis,timestamp:new Date().toISOString()});
    revalidatePath("/dashboard/financial");revalidatePath("/dashboard/financial/profitability");revalidatePath("/dashboard/financial/cash-flow");revalidatePath("/dashboard");
    return{ok:true as const,duplicate:false,duplicateKind:"none",correlationId};
  }catch(error){
    console.error("capability_operation_failed",{correlationId,capability:"financial-intelligence",operation:"update-expense",code:"FINANCIAL_EXPENSE_UPDATE_FAILED",retryable:true,timestamp:new Date().toISOString(),errorMessage:error instanceof Error?error.message:String(error)});
    return{ok:false as const,code:"FINANCIAL_EXPENSE_UPDATE_FAILED",message:"The expense was not updated. Retry, then share the correlation ID with support if it continues.",correlationId};
  }
}

const expenseArchiveInput = z.object({ expenseId: z.string().uuid(), workspaceId: z.string().uuid(), propertyId: z.string().uuid() });
export async function archiveFinancialExpenseAction(input:{expenseId:string;workspaceId:string;propertyId:string}):Promise<FinancialExpenseActionState>{
  const correlationId=crypto.randomUUID(),parsed=expenseArchiveInput.safeParse(input);
  if(!parsed.success)return{ok:false as const,code:"INVALID_EXPENSE",message:"The expense could not be identified.",correlationId};
  const{user}=await getSessionProfile();
  if(!user)return{ok:false as const,code:"AUTHENTICATION_REQUIRED",message:"Sign in before archiving an expense.",correlationId};
  try{
    const access=await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(),user.id,parsed.data.workspaceId);
    if(!evaluateWorkspacePermission(access,"financial.administration")||!evaluatePropertyAccess(access,parsed.data.propertyId))return{ok:false as const,code:"FINANCIAL_ACCESS_DENIED",message:"Your role or property access does not permit archiving expenses.",correlationId};
    const client=await createClient();
    const{error,data:updated}=await client.from("financial_transactions").update({status:"voided"}).eq("id",parsed.data.expenseId).eq("workspace_id",access.workspaceId).select("id").maybeSingle();
    if(error)throw error;
    if(!updated)return{ok:false as const,code:"EXPENSE_NOT_FOUND",message:"The expense could not be found in this workspace.",correlationId};
    console.info("financial_expense_archived",{correlationId,capability:"financial-intelligence",operation:"archive-expense",workspaceId:access.workspaceId,expenseId:parsed.data.expenseId,timestamp:new Date().toISOString()});
    revalidatePath("/dashboard/financial");revalidatePath("/dashboard/financial/profitability");revalidatePath("/dashboard/financial/cash-flow");revalidatePath("/dashboard");
    return{ok:true as const,correlationId};
  }catch(error){
    console.error("capability_operation_failed",{correlationId,capability:"financial-intelligence",operation:"archive-expense",code:"FINANCIAL_EXPENSE_ARCHIVE_FAILED",retryable:true,timestamp:new Date().toISOString(),errorMessage:error instanceof Error?error.message:String(error)});
    return{ok:false as const,code:"FINANCIAL_EXPENSE_ARCHIVE_FAILED",message:"The expense was not archived. Retry, then share the correlation ID with support if it continues.",correlationId};
  }
}

function minorUnits(value:string){const[whole,fraction=""]=value.split(".");return Number(whole)*100+Number(fraction.padEnd(2,"0"));}
