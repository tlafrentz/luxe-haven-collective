type CanonicalEntitlementProjection = Readonly<{status:string;effective_from:string;effective_until:string|null;resource_scope_type:string;resource_scope_id:string}>;
export function canonicalFurnishingEntitlementAvailable(rows:readonly CanonicalEntitlementProjection[],input:Readonly<{workspaceId:string;customerAccountId:string;now:string}>):boolean {
  const at=new Date(input.now).getTime();
  return rows.some(row=>row.status==="active"&&new Date(row.effective_from).getTime()<=at&&(!row.effective_until||new Date(row.effective_until).getTime()>at)&&((row.resource_scope_type==="workspace"&&row.resource_scope_id===input.workspaceId)||(row.resource_scope_type==="customer_account"&&row.resource_scope_id===input.customerAccountId)));
}
