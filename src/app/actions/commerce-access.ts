"use server";
import{redirect}from"next/navigation";import{revalidatePath}from"next/cache";import{createClient}from"@/lib/supabase/server";import{createAdminClient}from"@/lib/supabase/admin";import{resolveEntitlements,type CommerceEntitlementGrant}from"@/platform/commerce";
export async function getCommerceAccessWorkspace(input:Readonly<{workspaceId?:string;propertyId?:string}>={}){
 const client=await createClient(),{data:{user}}=await client.auth.getUser();if(!user)return null;
 const{data:customer,error:customerError}=await client.from("commerce_customers").select("id,workspace_id").eq("profile_id",user.id).maybeSingle();if(customerError)throw new Error(`commerce_customer_query_failed:${customerError.message}`);if(!customer)return{entitlements:[],credits:[],downloads:[],fulfillments:[],serviceOrders:[],version:"0",evaluatedAt:new Date()};
 const workspaceId=input.workspaceId??customer.workspace_id??undefined,scopeFilters=[`profile_id.eq.${user.id}`,...(workspaceId?[`workspace_id.eq.${workspaceId}`]:[]),...(input.propertyId?[`property_id.eq.${input.propertyId}`]:[])];
 const[{data:grants,error:grantsError},{data:downloads,error:downloadsError},{data:fulfillments,error:fulfillmentsError},{data:serviceOrders,error:serviceOrdersError}]=await Promise.all([
  client.from("commerce_entitlement_grants").select("*").or(scopeFilters.join(",")).eq("environment","live").order("created_at",{ascending:false}),
  client.from("commerce_download_grants").select("id,product_id,status,download_limit,download_count,effective_until,created_at").eq("profile_id",user.id),
  client.from("commerce_fulfillments").select("id,order_id,fulfillment_type,status,target_type,target_id,attempts,failure_code,created_at").order("created_at",{ascending:false}).limit(100),
  client.from("commerce_service_orders").select("id,service_type,status,intake_required,requested_at,property_id,opportunity_id").order("requested_at",{ascending:false}).limit(100),
 ]);
 const queryError=grantsError??downloadsError??fulfillmentsError??serviceOrdersError;if(queryError)throw new Error(`commerce_access_query_failed:${queryError.message}`);
 const mapped=(grants??[]).map(mapGrant),resolved=resolveEntitlements({grants:mapped,workspaceId,profileId:user.id,...(input.propertyId?{propertyId:input.propertyId}:{})});
 return Object.freeze({entitlements:resolved.entitlements,credits:mapped.filter(g=>g.quantity!==undefined),downloads:downloads??[],fulfillments:fulfillments??[],serviceOrders:serviceOrders??[],version:resolved.version,evaluatedAt:resolved.evaluatedAt});
}
export async function openProtectedCommerceDownload(formData:FormData){
 const id=String(formData.get("downloadGrantId")??""),client=await createClient(),{data:{user}}=await client.auth.getUser();if(!user)redirect("/login");
 const{data:grant}=await client.from("commerce_download_grants").select("id,asset_id,status,download_limit,download_count,effective_until").eq("id",id).eq("profile_id",user.id).maybeSingle();
 if(!grant||grant.status!=="active"||(grant.effective_until&&new Date(grant.effective_until)<=new Date())||(grant.download_limit!==null&&grant.download_count>=grant.download_limit))throw new Error("commerce_entitlement_unavailable");
 const admin=createAdminClient(),{data,error}=await admin.storage.from("commerce-assets").createSignedUrl(grant.asset_id,300,{download:true});if(error||!data?.signedUrl)throw new Error("commerce_fulfillment_adapter_unavailable");
 await admin.from("commerce_download_grants").update({download_count:grant.download_count+1}).eq("id",grant.id);redirect(data.signedUrl);
}
export async function retryCommerceFulfillment(formData:FormData){
 const client=await createClient(),{data:{user}}=await client.auth.getUser();if(!user)throw new Error("commerce_permission_denied");const{data:isAdmin}=await client.rpc("is_admin");if(isAdmin!==true)throw new Error("commerce_permission_denied");
 const outboxId=String(formData.get("outboxId")??"");if(!outboxId.startsWith("commerce-outbox-"))throw new Error("commerce_idempotency_conflict");
 const admin=createAdminClient(),{error}=await admin.rpc("process_commerce_fulfillment_outbox",{p_outbox_id:outboxId});if(error)throw new Error("commerce_fulfillment_failed");
 await admin.from("commerce_operational_activity").insert({id:`commerce-operation-fulfillment-retry-${crypto.randomUUID()}`,action_type:"fulfillment-retried",subject_type:"outbox",subject_id:outboxId,actor_profile_id:user.id,reason:"Administrator retried an eligible failed fulfillment handoff.",result:"succeeded"});
 revalidatePath("/admin/commerce/fulfillment");revalidatePath("/admin/commerce/health");
}
export async function transitionCommerceEntitlement(formData:FormData){
 const client=await createClient(),grantId=String(formData.get("grantId")??""),action=String(formData.get("transition")??""),reason=String(formData.get("reason")??""),revision=Number(formData.get("revision"));
 if(!["suspend","resume","expire","revoke"].includes(action)||!Number.isInteger(revision))throw new Error("commerce_entitlement_unavailable");
 const{error}=await client.rpc("admin_transition_commerce_entitlement",{p_grant_id:grantId,p_action:action,p_expected_revision:revision,p_reason:reason});if(error)throw new Error(error.message);
 revalidatePath("/admin/commerce/entitlements");
}
function mapGrant(row:Record<string,unknown>):CommerceEntitlementGrant{return Object.freeze({id:String(row.id),entitlementTemplateId:String(row.entitlement_template_id),entitlementKey:String(row.entitlement_key),scopeType:row.scope_type as CommerceEntitlementGrant["scopeType"],...(row.workspace_id?{workspaceId:String(row.workspace_id)}:{}),...(row.profile_id?{profileId:String(row.profile_id)}:{}),...(row.property_id?{propertyId:String(row.property_id)}:{}),...(row.opportunity_id?{opportunityId:String(row.opportunity_id)}:{}),...(row.order_id?{orderId:String(row.order_id)}:{}),sourceType:row.source_type as CommerceEntitlementGrant["sourceType"],sourceId:String(row.source_id),...(row.quantity!==null?{quantity:Number(row.quantity)}:{}),...(row.remaining_quantity!==null?{remainingQuantity:Number(row.remaining_quantity)}:{}),status:row.status as CommerceEntitlementGrant["status"],effectiveFrom:new Date(String(row.effective_from)),...(row.effective_until?{effectiveUntil:new Date(String(row.effective_until))}:{}),revision:Number(row.revision),createdAt:new Date(String(row.created_at)),updatedAt:new Date(String(row.updated_at))})}
