import {
  evaluatePropertyAccess,
  evaluateWorkspacePermission,
  workspaceRolePolicyVersion,
  type WorkspaceAccessContext,
} from "@/features/workspace";

export type InvestmentAuthorizationOperation =
  | "opportunity.create" | "opportunity.read" | "opportunity.modify" | "opportunity.archive"
  | "analysis.read" | "analysis.create" | "analysis.reanalyze" | "analysis.compare"
  | "scenario.read" | "scenario.create" | "scenario.modify"
  | "report.read" | "report.generate"
  | "note.read" | "note.create"
  | "activity.read";

export type InvestmentAuthorizationResource = Readonly<{
  workspaceId:string;
  propertyId?:string;
  opportunityId?:string;
  analysisVersionId?:string;
  archived?:boolean;
}>;

export type InvestmentAuthorizationDecision = Readonly<{
  allowed:boolean;
  operation:InvestmentAuthorizationOperation;
  policy:string;
  reason:"allowed"|"inactive-membership"|"workspace-mismatch"|"permission-denied"|"property-denied"|"archived";
}>;

const manageOperations=new Set<InvestmentAuthorizationOperation>([
  "opportunity.create","opportunity.modify","opportunity.archive","analysis.create","analysis.reanalyze",
  "scenario.create","scenario.modify","note.create",
]);
const reportOperations=new Set<InvestmentAuthorizationOperation>(["report.read","report.generate"]);

export function evaluateInvestmentAuthorization(
  context:WorkspaceAccessContext,
  operation:InvestmentAuthorizationOperation,
  resource:InvestmentAuthorizationResource,
):InvestmentAuthorizationDecision {
  const decision=(allowed:boolean,reason:InvestmentAuthorizationDecision["reason"])=>Object.freeze({allowed,operation,policy:`investment-intelligence-auth-v1/${workspaceRolePolicyVersion}`,reason});
  if(context.status!=="active")return decision(false,"inactive-membership");
  if(context.workspaceId!==resource.workspaceId)return decision(false,"workspace-mismatch");
  const permission=reportOperations.has(operation)
    ? operation==="report.generate"?"reports.generate":"reports.view"
    :"intelligence.view";
  if(!evaluateWorkspacePermission(context,permission))return decision(false,"permission-denied");
  const elevated=context.role==="owner"||context.role==="administrator";
  if(resource.propertyId){
    if(!evaluatePropertyAccess(context,resource.propertyId))return decision(false,"property-denied");
  }else if(!elevated){
    return decision(false,"property-denied");
  }
  if(manageOperations.has(operation)&&!["owner","administrator","operator","contributor"].includes(context.role))return decision(false,"permission-denied");
  if(resource.archived&&["analysis.create","analysis.reanalyze","scenario.create","scenario.modify","note.create","opportunity.modify"].includes(operation))return decision(false,"archived");
  return decision(true,"allowed");
}

export class InvestmentAuthorizationError extends Error {
  constructor(public readonly decision:InvestmentAuthorizationDecision,public readonly disclosure:"not-found"|"forbidden"){
    super(disclosure==="not-found"?"Investment resource was not found.":"Investment operation is forbidden.");
    this.name="InvestmentAuthorizationError";
  }
}

export function requireInvestmentAuthorization(context:WorkspaceAccessContext,operation:InvestmentAuthorizationOperation,resource:InvestmentAuthorizationResource):InvestmentAuthorizationDecision{
  const decision=evaluateInvestmentAuthorization(context,operation,resource);
  if(!decision.allowed)throw new InvestmentAuthorizationError(decision,isReadOperation(operation)?"not-found":"forbidden");
  return decision;
}
export function isReadOperation(operation:InvestmentAuthorizationOperation){return operation.endsWith(".read")||operation==="analysis.compare";}
