import { createClient } from "@supabase/supabase-js";
import { RegisterControlledVerificationIdentity, SupabaseControlledIdentityRegistrationRepository, SupabaseIdentityRegistrationAuthorization, VERIFICATION_SCENARIOS } from "../../src/platform/production-verification";

const required=(name:string)=>{const value=process.env[name]?.trim();if(!value)throw new Error(`Missing ${name}.`);return value};
if(process.env.CA001F_CONFIRM_CONTROLLED_IDENTITY_REGISTRATION!=="I_CONFIRM_CA001F_CONTROLLED_IDENTITY_REGISTRATION")throw new Error("Explicit controlled identity registration confirmation is required.");
const raw=JSON.parse(required("CA001F_CONTROLLED_IDENTITY_JSON")) as Record<string,unknown>;
const allowed=new Set(VERIFICATION_SCENARIOS.map(value=>value.code));const scenarioCodes=Array.isArray(raw.allowedScenarioCodes)?raw.allowedScenarioCodes.map(String):[];
if(!scenarioCodes.length||scenarioCodes.some(code=>!allowed.has(code)))throw new Error("Controlled identity scenario scope is invalid.");
const client=createClient(required("NEXT_PUBLIC_SUPABASE_URL"),required("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
const operation=new RegisterControlledVerificationIdentity(new SupabaseIdentityRegistrationAuthorization(client),new SupabaseControlledIdentityRegistrationRepository(client));
const result=await operation.execute({actorId:required("CA001F_REGISTRATION_ACTOR_ID"),correlationId:crypto.randomUUID(),identity:{opaqueAuthSubjectReference:String(raw.opaqueAuthSubjectReference),identityTypeCode:String(raw.identityTypeCode),...(raw.tenantId?{tenantId:String(raw.tenantId)}:{}),...(raw.customerAccountId?{customerAccountId:String(raw.customerAccountId)}:{}),allowedScenarioCodes:scenarioCodes,expiresAt:new Date(String(raw.expiresAt)),fixtureOwnershipCode:String(raw.fixtureOwnershipCode),retentionClassification:raw.retentionClassification==="cleanup_required"?"cleanup_required":"retain"}});
process.stdout.write(JSON.stringify({status:result.registered?"registered":"unchanged",fingerprint:result.fingerprint}));
