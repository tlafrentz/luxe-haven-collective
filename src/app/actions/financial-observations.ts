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
  amount: z.coerce.number().positive().max(100_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
  basis: z.enum(["actual","forecast","scenario","budget","target"]),
  frequency: z.enum(["one-time","nightly","weekly","monthly","quarterly","annual"]),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  sourceReference: z.string().trim().max(200).optional(),
  idempotencyKey: z.string().uuid(),
});

export type FinancialExpenseActionState={ok?:boolean;code?:string;message?:string;correlationId?:string;duplicate?:boolean};
export async function recordFinancialExpenseAction(_previous:FinancialExpenseActionState,formData:FormData):Promise<FinancialExpenseActionState>{
  const correlationId=crypto.randomUUID(),parsed=expenseInput.safeParse(Object.fromEntries(formData));
  if(!parsed.success)return{ok:false as const,code:"INVALID_EXPENSE",message:"Review the amount, category, period, and source information.",correlationId};
  const input=parsed.data,{user}=await getSessionProfile();
  if(!user)return{ok:false as const,code:"AUTHENTICATION_REQUIRED",message:"Sign in before recording an expense.",correlationId};
  try{
    const access=await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(),user.id,input.workspaceId);
    if(!evaluateWorkspacePermission(access,"financial.administration")||!evaluatePropertyAccess(access,input.propertyId))return{ok:false as const,code:"FINANCIAL_ACCESS_DENIED",message:"Your role or property access does not permit expense entry.",correlationId};
    const client=await createClient();
    const{data:property}=await client.from("properties").select("id").eq("id",input.propertyId).eq("owner_id",access.workspaceId).maybeSingle();
    if(!property)return{ok:false as const,code:"PROPERTY_ACCESS_DENIED",message:"The selected property is outside the active workspace.",correlationId};
    const code=`EXP-${input.category.toUpperCase()}`,{data:account,error:accountError}=await client.from("financial_accounts").upsert({
      workspace_id:access.workspaceId,code,name:input.category.replaceAll("-"," ").replace(/\b\w/g,letter=>letter.toUpperCase()),
      category:input.category==="furniture"||input.category==="equipment"||input.category==="renovations"||input.category==="replacement-reserve"||input.category==="capital-improvements"?"capital-expense":"operating-expense",
      subcategory:input.category,active:true,
    },{onConflict:"workspace_id,code"}).select("id").single();
    if(accountError||!account)throw accountError??new Error("financial_account_unavailable");
    const evidenceIds=input.sourceReference?[`manual-source:${input.sourceReference}`]:[];
    const{error}=await client.from("financial_transactions").insert({
      workspace_id:access.workspaceId,account_id:account.id,property_id:input.propertyId,
      amount_minor:Math.round(input.amount*100),currency:input.currency,measurement:input.basis,
      effective_date:input.effectiveDate,effective_to:input.effectiveTo||null,frequency:input.frequency,
      posting_date:input.effectiveDate,status:"posted",
      source_provider:"manual",source_external_id:input.sourceReference||null,evidence_ids:evidenceIds,
      idempotency_key:input.idempotencyKey,created_by_profile_id:user.id,
    });
    if(error){if(error.code==="23505")return{ok:true as const,duplicate:true,correlationId};throw error;}
    console.info("financial_expense_recorded",{correlationId,capability:"financial-intelligence",operation:"record-expense",workspaceId:access.workspaceId,propertyId:input.propertyId,category:input.category,basis:input.basis,timestamp:new Date().toISOString()});
    revalidatePath("/dashboard/financial");revalidatePath("/dashboard/financial/profitability");revalidatePath("/dashboard/financial/cash-flow");revalidatePath("/dashboard");
    return{ok:true as const,duplicate:false,correlationId};
  }catch(error){
    console.error("capability_operation_failed",{correlationId,capability:"financial-intelligence",operation:"record-expense",code:"FINANCIAL_EXPENSE_PERSISTENCE_FAILED",retryable:true,timestamp:new Date().toISOString(),errorType:error instanceof Error?error.name:"unknown"});
    return{ok:false as const,code:"FINANCIAL_EXPENSE_PERSISTENCE_FAILED",message:"The expense was not saved. Retry, then share the correlation ID with support if it continues.",correlationId};
  }
}
