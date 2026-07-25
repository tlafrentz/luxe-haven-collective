import "server-only";
import {buildPortfolioProjection} from "@/features/portfolio/application/read-model";
import type{PortfolioComparison}from "@/features/portfolio";
import{getPortfolioComposition,SupabasePortfolioCompositionInputReader,SupabasePortfolioProjectionSource}from "@/features/portfolio-intelligence";
import{resolveWorkspaceAccessContext,SupabaseTeamAccessRepository}from "@/features/workspace";
import{getSessionProfile}from "@/lib/auth/session";
import{portfolioPeriod}from "./portfolio-overview-runtime";
export async function getPortfolioCompositionRouteState(input:Readonly<{workspaceId?:string;propertyIds?:readonly string[];periodPreset:"30d"|"90d"|"ytd"|"12m";comparisonType:PortfolioComparison;now?:Date}>){
  const started=Date.now();
  try{
    const{user}=await getSessionProfile();if(!user)return{ok:false as const,code:"permission"as const,message:"Sign in to view portfolio composition."};
    const access=await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(),user.id,input.workspaceId);
    const now=input.now??new Date();const period=portfolioPeriod(input.periodPreset,input.comparisonType,now);const source=new SupabasePortfolioProjectionSource();
    const projection=await buildPortfolioProjection(source,{access,workspaceId:access.workspaceId,period,propertyIds:input.propertyIds,evaluatedAt:now.toISOString(),evidenceThreshold:1});
    const reader=new SupabasePortfolioCompositionInputReader();const compositionInput=await reader.read(access.workspaceId,projection.scope.propertyIds,period.current);
    const comparison=period.comparison?await buildPortfolioProjection(source,{access,workspaceId:access.workspaceId,period:{current:period.comparison,comparisonType:"none"},propertyIds:input.propertyIds,evaluatedAt:now.toISOString(),evidenceThreshold:1}):undefined;
    const comparisonInput=comparison&&period.comparison?await reader.read(access.workspaceId,comparison.scope.propertyIds,period.comparison):undefined;
    const composition=getPortfolioComposition({projection,input:compositionInput,comparison,comparisonInput});
    console.info("portfolio_composition_evaluated",{workspaceId:access.workspaceId,scopeType:projection.scope.authorization.type,authorizedPropertyCount:projection.scope.propertyCount,comparisonType:period.comparisonType,durationMilliseconds:Date.now()-started,confidence:composition.confidence,freshness:composition.freshness,projectionVersion:"portfolio-projection-v1"});
    return{ok:true as const,composition};
  }catch(error){console.error("portfolio_composition_failed",{errorType:error instanceof Error?error.name:"unknown",durationMilliseconds:Date.now()-started});return{ok:false as const,code:"unavailable"as const,message:"Your workspace remains available. No composition data was changed."};}
}
