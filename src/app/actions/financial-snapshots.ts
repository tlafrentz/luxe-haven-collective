"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  buildFinancialReadModel,
  SupabaseFinancialOverviewSource,
  SupabaseFinancialSnapshotWriter,
  type FinancialBasis,
} from "@/features/financial-intelligence";
import { evaluateWorkspacePermission, resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { getSessionProfile } from "@/lib/auth/session";

const inputSchema=z.object({
  workspaceId:z.string().uuid(),
  propertyIds:z.string().transform(value=>value.split(",").filter(Boolean)),
  from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  basis:z.enum(["actual","forecast","scenario","budget","target"]),
});
export type FinancialSnapshotActionState={ok?:boolean;code?:string;message?:string;correlationId?:string;snapshotId?:string};

export async function generateFinancialSnapshotAction(_previous:FinancialSnapshotActionState,formData:FormData):Promise<FinancialSnapshotActionState>{
  const correlationId=crypto.randomUUID(),parsed=inputSchema.safeParse(Object.fromEntries(formData));
  if(!parsed.success)return{ok:false,code:"INVALID_SNAPSHOT_REQUEST",message:"Choose a valid period and financial basis.",correlationId};
  const{user}=await getSessionProfile();
  if(!user)return{ok:false,code:"AUTHENTICATION_REQUIRED",message:"Sign in before generating a Financial Snapshot.",correlationId};
  try{
    const input=parsed.data,access=await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(),user.id,input.workspaceId);
    if(!evaluateWorkspacePermission(access,"financial.administration"))return{ok:false,code:"FINANCIAL_ACCESS_DENIED",message:"Your role does not permit Financial Snapshot generation.",correlationId};
    console.info("financial_snapshot_started",{correlationId,capability:"financial-intelligence",operation:"generate-snapshot",workspaceId:access.workspaceId,basis:input.basis,timestamp:new Date().toISOString()});
    const model=await buildFinancialReadModel(new SupabaseFinancialOverviewSource(),{
      access,workspaceId:access.workspaceId,propertyIds:input.propertyIds,
      period:{kind:"custom",from:input.from,to:input.to,reportingCalendar:"fiscal"},
      basis:input.basis as FinancialBasis,authorizationLevel:"read",
    });
    if(model.snapshot.revenue===null&&model.snapshot.expenses===null) {
      return{ok:false,code:"INSUFFICIENT_FINANCIAL_OBSERVATIONS",message:`No ${input.basis} revenue or expense observations exist for this period. Record or import evidence first.`,correlationId};
    }
    await new SupabaseFinancialSnapshotWriter().put(model.snapshot,user.id);
    console.info("financial_snapshot_completed",{correlationId,capability:"financial-intelligence",operation:"generate-snapshot",workspaceId:access.workspaceId,snapshotId:model.snapshot.id,basis:model.snapshot.basis,timestamp:new Date().toISOString()});
    revalidatePath("/dashboard/financial");
    return{ok:true,message:"Financial Snapshot generated.",correlationId,snapshotId:model.snapshot.id};
  }catch(error){
    console.error("capability_operation_failed",{correlationId,capability:"financial-intelligence",operation:"generate-snapshot",code:"FINANCIAL_SNAPSHOT_GENERATION_FAILED",retryable:true,timestamp:new Date().toISOString(),errorType:error instanceof Error?error.name:"unknown"});
    return{ok:false,code:"FINANCIAL_SNAPSHOT_GENERATION_FAILED",message:"The snapshot was not generated. Retry, then share the correlation ID with support if it continues.",correlationId};
  }
}
