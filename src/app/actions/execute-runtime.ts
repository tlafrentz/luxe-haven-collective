import "server-only";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { ExecutePlanApplicationService, SupabaseExecuteActivityRepository, SupabaseExecutePlanRepository, SupabaseExecuteUnitOfWork, SupabasePlatformActionRepository, type ExecuteAuthorization, type ExecuteSupabaseClient } from "@/platform/actions";
import { SupabasePortfolioDecisionRepository } from "@/features/portfolio-intelligence";

export type ExecuteRuntime = Readonly<{service:ExecutePlanApplicationService;decisions:SupabasePortfolioDecisionRepository;actor:Readonly<{type:"user";id:string}>;workspaceId:string}>;
export type ExecuteRuntimeResult=Readonly<{ok:true;runtime:ExecuteRuntime}>|Readonly<{ok:false;code:"UNAUTHENTICATED"|"WORKSPACE_UNAVAILABLE"|"DEPENDENCY_UNAVAILABLE";message:string}>;

export async function composeExecuteRuntime():Promise<ExecuteRuntimeResult>{
  try{
    const client=await createClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)return{ok:false,code:"UNAUTHENTICATED",message:"Sign in before using Execute."};
    const team=new SupabaseTeamAccessRepository();let access;try{access=await resolveWorkspaceAccessContext(team,user.id);}catch{return{ok:false,code:"WORKSPACE_UNAVAILABLE",message:"An active workspace is required to use Execute."};}
    const members=await team.members(access);const actor={type:"user" as const,id:user.id};const database=client as unknown as ExecuteSupabaseClient;const plans=new SupabaseExecutePlanRepository(database);const activity=new SupabaseExecuteActivityRepository(database);const canonical=new SupabasePlatformActionRepository(client as unknown as ConstructorParameters<typeof SupabasePlatformActionRepository>[0]);
    const canProperty=(propertyId:string)=>access.propertyAccess.type==="all"||(access.propertyAccess.type==="selected"&&access.propertyAccess.propertyIds.includes(propertyId));
    const authorization:ExecuteAuthorization={
      canManagePlans:async(input)=>input.workspaceId===access.workspaceId&&input.actor.id===user.id&&["owner","administrator","operator"].includes(access.role),
      canAccessProperty:async(input)=>input.workspaceId===access.workspaceId&&input.actor.id===user.id&&canProperty(input.propertyId),
      canAssign:async(input)=>{
        if(input.workspaceId!==access.workspaceId||input.actor.id!==user.id)return false;
        if(input.propertyId&&!canProperty(input.propertyId))return false;
        if(!input.owner)return true;
        if(input.owner.type!=="user")return ["team","system","automation"].includes(input.owner.type);
        return Boolean(input.owner.id&&members.some((member)=>member.profileId===input.owner?.id&&member.status==="active"&&(input.propertyId===undefined||member.propertyAccess.type==="all"||(member.propertyAccess.type==="selected"&&member.propertyAccess.propertyIds.includes(input.propertyId)))));
      },
    };
    const unitOfWork=new SupabaseExecuteUnitOfWork({client:database,plans,actions:canonical,activity});let sequence=0;const service=new ExecutePlanApplicationService({unitOfWork,authorization,createId:()=>`execute-${crypto.randomUUID()}-${++sequence}`,now:()=>new Date()});return{ok:true,runtime:Object.freeze({service,decisions:new SupabasePortfolioDecisionRepository(),actor,workspaceId:access.workspaceId})};
  }catch{return{ok:false,code:"DEPENDENCY_UNAVAILABLE",message:"Execute is temporarily unavailable. No records were changed."};}
}
