"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { evaluateWorkspacePermission, resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";

const accountTypes=["operating","reserve","tax","other-cash"] as const;
const balanceSchema=z.object({workspaceId:z.string().uuid(),name:z.string().trim().min(1).max(120),accountType:z.enum(accountTypes),balance:z.string().regex(/^-?\d{1,12}(\.\d{1,2})?$/),asOf:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),currency:z.string().regex(/^[A-Z]{3}$/).default("USD"),notes:z.string().trim().max(1000).optional(),idempotencyKey:z.string().uuid()});
const importRow=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),account:z.string().trim().min(1).max(120),description:z.string().trim().max(500).default(""),amount:z.number().finite().optional(),category:z.string().trim().max(120).default(""),balance:z.number().finite().optional()}).refine(row=>row.amount!==undefined||row.balance!==undefined,"Amount or balance is required");
const importSchema=z.object({workspaceId:z.string().uuid(),importId:z.string().uuid(),rows:z.array(importRow).min(1).max(5000)});
export type CashAcquisitionState=Readonly<{ok?:boolean;message?:string;code?:string;accounts?:number;transactions?:number;balances?:number}>;

export async function recordCashBalanceAction(_state:CashAcquisitionState,formData:FormData):Promise<CashAcquisitionState>{
  const parsed=balanceSchema.safeParse(Object.fromEntries(formData));if(!parsed.success)return{ok:false,code:"INVALID_BALANCE",message:"Review the account, balance, and as-of date."};
  const scope=await authorize(parsed.data.workspaceId);if(!scope.ok)return scope.state;const input=parsed.data,client=await createClient(),code=`CASH-${slug(input.name)}`;
  const{data:account,error:accountError}=await client.from("financial_accounts").upsert({workspace_id:scope.workspaceId,code,name:input.name,category:input.accountType==="reserve"?"reserve":"asset",subcategory:input.accountType,account_type:input.accountType,status:"active",source_type:"manual",notes:input.notes||null,active:true},{onConflict:"workspace_id,code"}).select("id").single();
  if(accountError||!account)return failure("BALANCE_SAVE_FAILED");const{error}=await client.from("cash_balance_observations").insert({workspace_id:scope.workspaceId,account_id:account.id,amount_minor:minor(input.balance),currency:input.currency,as_of:input.asOf,source_type:"manual",idempotency_key:input.idempotencyKey,recorded_by_profile_id:scope.userId});
  if(error&&error.code!=="23505")return failure("BALANCE_SAVE_FAILED");refresh();return{ok:true,message:"Cash account added.",accounts:1,balances:1,transactions:0};
}

export async function importFinancialCsvAction(_state:CashAcquisitionState,formData:FormData):Promise<CashAcquisitionState>{
  let rows:unknown;try{rows=JSON.parse(String(formData.get("rows")??"[]"));}catch{return{ok:false,code:"INVALID_CSV",message:"The validated rows could not be read."};}
  const parsed=importSchema.safeParse({workspaceId:formData.get("workspaceId"),importId:formData.get("importId"),rows});if(!parsed.success)return{ok:false,code:"INVALID_CSV",message:"Review invalid dates, accounts, amounts, or balances before importing."};
  const scope=await authorize(parsed.data.workspaceId);if(!scope.ok)return scope.state;const client=await createClient(),accounts=new Map<string,string>();let transactions=0,balances=0;
  for(const[rowIndex,row]of parsed.data.rows.entries()){
    const key=row.account.trim().toLocaleLowerCase("en-US"),existing=accounts.get(key);let accountId=existing;
    if(!accountId){const{data:account,error}=await client.from("financial_accounts").upsert({workspace_id:scope.workspaceId,code:`CASH-${slug(row.account)}`,name:row.account,category:"asset",subcategory:"operating",account_type:"operating",status:"active",source_type:"csv",active:true},{onConflict:"workspace_id,code"}).select("id").single();if(error||!account)return failure("CSV_IMPORT_FAILED");accountId=String(account.id);accounts.set(key,accountId);}
    const resolvedAccountId=accountId;if(!resolvedAccountId)return failure("CSV_IMPORT_FAILED");
    if(row.balance!==undefined){const{error}=await client.from("cash_balance_observations").insert({workspace_id:scope.workspaceId,account_id:resolvedAccountId,amount_minor:Math.round(row.balance*100),currency:"USD",as_of:row.date,source_type:"csv",source_reference:parsed.data.importId,idempotency_key:`csv:${parsed.data.importId}:balance:${rowIndex}`,recorded_by_profile_id:scope.userId});if(error&&error.code!=="23505")return failure("CSV_IMPORT_FAILED");balances++;}
    if(row.amount!==undefined){const{error}=await client.from("financial_transactions").insert({workspace_id:scope.workspaceId,account_id:resolvedAccountId,property_id:null,amount_minor:Math.round(Math.abs(row.amount)*100),currency:"USD",measurement:"actual",effective_date:row.date,frequency:"one-time",posting_date:row.date,status:"posted",source_provider:"csv",source_external_id:`${parsed.data.importId}:${rowIndex}`,evidence_ids:[`csv-import:${parsed.data.importId}`],idempotency_key:`csv:${parsed.data.importId}:transaction:${rowIndex}`,created_by_profile_id:scope.userId,direction:row.amount<0?"outflow":"inflow",description:row.description||null,import_category:row.category||null});if(error&&error.code!=="23505")return failure("CSV_IMPORT_FAILED");transactions++;}
  }
  refresh();return{ok:true,message:"Financial data imported.",accounts:accounts.size,transactions,balances};
}
async function authorize(workspaceId:string){const{user}=await getSessionProfile();if(!user)return{ok:false as const,state:{ok:false,code:"AUTHENTICATION_REQUIRED",message:"Sign in before adding financial data."}};try{const access=await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(),user.id,workspaceId);if(!evaluateWorkspacePermission(access,"financial.administration"))return{ok:false as const,state:{ok:false,code:"FINANCIAL_ACCESS_DENIED",message:"Your role does not permit financial data entry."}};return{ok:true as const,workspaceId:access.workspaceId,userId:user.id};}catch{return{ok:false as const,state:{ok:false,code:"FINANCIAL_ACCESS_DENIED",message:"The financial workspace is unavailable."}};}}
function slug(value:string){return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"ACCOUNT";}function minor(value:string){const amount=Number(value);return Math.round(amount*100);}function failure(code:string):CashAcquisitionState{return{ok:false,code,message:"Financial data was not saved. Retry without changing historical data."};}function refresh(){for(const path of ["/dashboard/observe/financial/cash-flow","/dashboard/financial/cash-flow","/dashboard/observe/financial/forecast","/dashboard/financial/planning","/dashboard/observe/financial"])revalidatePath(path);}
