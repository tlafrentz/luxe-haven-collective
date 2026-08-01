import "server-only";
import { SupabaseExpenseWorkspaceSource, type FinancialExpenseBasis } from "@/features/financial-intelligence";
import { evaluatePropertyAccess, resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { getSessionProfile } from "@/lib/auth/session";

export async function getFinancialExpenseWorkspaceRouteState(input:{workspaceId:string;propertyIds:readonly string[];from:string;to:string;basis:FinancialExpenseBasis}){
  try{
    const{user}=await getSessionProfile();if(!user)return{ok:false as const,code:"permission",message:"Sign in to view expenses."};
    const access=await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(),user.id,input.workspaceId);
    const propertyIds=input.propertyIds.filter(id=>evaluatePropertyAccess(access,id));
    const workspace=await new SupabaseExpenseWorkspaceSource().read({...input,workspaceId:access.workspaceId,propertyIds});
    return{ok:true as const,workspace};
  }catch(error){return{ok:false as const,code:"read",message:error instanceof Error?error.message:"Expenses could not be loaded."};}
}
