import type { PortfolioComposition } from "../application/composition";
export type PortfolioCompositionCacheContext=Readonly<{workspaceId:string;membershipId:string;role:string;propertyIds:readonly string[];from:string;to:string;comparisonType:string;comparisonFrom?:string;comparisonTo?:string;projectionVersion:string}>;
export function portfolioCompositionCacheKey(context:PortfolioCompositionCacheContext){return["portfolio-composition-v1",context.workspaceId,context.membershipId,context.role,[...context.propertyIds].sort().join(","),context.from,context.to,context.comparisonType,context.comparisonFrom??"-",context.comparisonTo??"-",context.projectionVersion].join("|");}
export class AuthorizationAwarePortfolioCompositionCache{
  private entries=new Map<string,Readonly<{value:PortfolioComposition;expiresAt:number}>>();
  constructor(private ttl=60_000,private now=()=>Date.now()){}
  get(context:PortfolioCompositionCacheContext){const entry=this.entries.get(portfolioCompositionCacheKey(context));return!entry||entry.expiresAt<=this.now()?null:entry.value;}
  set(context:PortfolioCompositionCacheContext,value:PortfolioComposition){this.entries.set(portfolioCompositionCacheKey(context),{value,expiresAt:this.now()+this.ttl});}
  invalidateWorkspace(workspaceId:string){for(const key of this.entries.keys())if(key.startsWith(`portfolio-composition-v1|${workspaceId}|`))this.entries.delete(key);}
}
