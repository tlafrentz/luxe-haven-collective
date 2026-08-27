import { describe,expect,it } from "vitest";
import { canonicalFurnishingEntitlementAvailable } from "./furnishing-entitlement-projection";

const now="2026-08-27T00:00:00.000Z",workspaceId="4abe0850-6ad7-40a0-89bb-b1fb5e6afe82",customerAccountId="11111111-1111-4111-8111-111111111111";
const entitlement=(overrides:Partial<{status:string;effective_from:string;effective_until:string|null;resource_scope_type:string;resource_scope_id:string}>={})=>({status:"active",effective_from:"2026-08-26T00:00:00.000Z",effective_until:"2026-08-28T00:00:00.000Z",resource_scope_type:"workspace",resource_scope_id:workspaceId,...overrides});

describe("canonical furnishing entitlement projection",()=>{
 it("accepts an effective active workspace entitlement",()=>expect(canonicalFurnishingEntitlementAvailable([entitlement()],{workspaceId,customerAccountId,now})).toBe(true));
 it("accepts an effective customer-account entitlement",()=>expect(canonicalFurnishingEntitlementAvailable([entitlement({resource_scope_type:"customer_account",resource_scope_id:customerAccountId})],{workspaceId,customerAccountId,now})).toBe(true));
 it.each([
  ["expired",entitlement({effective_until:"2026-08-26T23:59:59.000Z"})],
  ["future",entitlement({effective_from:"2026-08-28T00:00:00.000Z"})],
  ["suspended",entitlement({status:"suspended"})],
  ["wrong workspace",entitlement({resource_scope_id:"22222222-2222-4222-8222-222222222222"})],
 ] as const)("rejects %s entitlement",(_label,row)=>expect(canonicalFurnishingEntitlementAvailable([row],{workspaceId,customerAccountId,now})).toBe(false));
});
