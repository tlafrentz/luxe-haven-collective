import { createClient } from "@supabase/supabase-js";
import { RegisterProductionVerificationDefinitions, SupabaseDefinitionRegistrationAuthorization, SupabaseVerificationDefinitionRepository } from "../../src/platform/production-verification";

if (process.env.CA001F_CONFIRM_PRODUCTION_REGISTRATION !== "I_CONFIRM_CA001F_PRODUCTION_REGISTRATION") throw new Error("Explicit CA-001F production registration confirmation is required.");
const required = (name: string) => { const value = process.env[name]?.trim(); if (!value) throw new Error(`Missing ${name}.`); return value; };
const client = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const actorId = required("CA001F_REGISTRATION_ACTOR_ID");
const operation = new RegisterProductionVerificationDefinitions(new SupabaseDefinitionRegistrationAuthorization(client), new SupabaseVerificationDefinitionRepository(client));
const result = await operation.execute({ actorId, environmentCode: "production", correlationId: crypto.randomUUID() });
process.stdout.write(JSON.stringify({ status: "registered", created: result.created, unchanged: result.unchanged, registryFingerprint: result.fingerprint }));
