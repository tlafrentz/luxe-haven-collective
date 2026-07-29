import { createAdminClient } from "@/lib/supabase/admin";
import { Money } from "@/platform/kernel";
import type { FinancialSnapshot } from "../domain";
import type { FinancialSnapshotWriter } from "./financial-overview-projection-adapter";

export class SupabaseFinancialSnapshotWriter implements FinancialSnapshotWriter{
  async put(snapshot:FinancialSnapshot,actorProfileId:string){
    const admin=createAdminClient(),serialized=serialize(snapshot),fingerprint=snapshot.id.replace("financial-snapshot-","");
    const{error}=await admin.from("financial_snapshots").upsert({
      id:snapshot.id,workspace_id:snapshot.workspaceId,property_id:snapshot.propertyId??null,portfolio_id:snapshot.portfolioId??null,
      period_from:snapshot.period.from,period_to:snapshot.period.to,schema_version:snapshot.schemaVersion,
      basis:snapshot.basis,
      calculation_version:"financial-calculation.v1",source_fingerprint:fingerprint,snapshot:serialized,
      confidence:snapshot.confidence,freshness:snapshot.freshness,captured_at:snapshot.capturedAt,created_by_profile_id:actorProfileId,
    },{onConflict:"id",ignoreDuplicates:true});
    if(error)throw new Error(`Financial snapshot persistence failed: ${error.message}`);
  }
}
function serialize(value:unknown):unknown{
  if(value instanceof Money)return value.serialize();
  if(Array.isArray(value))return value.map(serialize);
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,serialize(entry)]));
  return value;
}
