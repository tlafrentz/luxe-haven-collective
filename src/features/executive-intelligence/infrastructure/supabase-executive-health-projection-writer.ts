import { createAdminClient } from "@/lib/supabase/admin";
import type { ExecutiveHealthProjectionWriter } from "../application/executive-health-projection-writer";
import type { ExecutiveBusinessHealthProjection } from "../domain";

export class SupabaseExecutiveHealthProjectionWriter implements ExecutiveHealthProjectionWriter{
  async put(projection:ExecutiveBusinessHealthProjection,actorProfileId:string){
    const{error}=await createAdminClient().from("executive_health_projections").upsert({
      id:projection.id,workspace_id:projection.workspaceId,period_from:projection.period.from,period_to:projection.period.to,
      schema_version:projection.schemaVersion,calculation_version:projection.lineage.calculationVersion,projection,
      score:projection.score,confidence:projection.confidence.score,evidence_artifact_ids:projection.lineage.artifactIds,
      generated_at:projection.generatedAt,created_by_profile_id:actorProfileId,
    },{onConflict:"id",ignoreDuplicates:true});
    if(error)throw new Error(`Executive Health projection persistence failed: ${error.message}`);
  }
}
