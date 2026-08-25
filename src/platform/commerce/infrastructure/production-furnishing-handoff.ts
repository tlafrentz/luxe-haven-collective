import { createClient } from "@/lib/supabase/server";
import { SupabaseFurnishingHandoffRepository } from "./supabase-furnishing-handoff-repository";
export async function createProductionFurnishingHandoffRepository() { return new SupabaseFurnishingHandoffRepository(await createClient()); }

/** Production lifecycle composition: all mutating handoff/session/project/recovery operations use SECURITY DEFINER RPCs. */
export async function createProductionFurnishingLifecycleRepository() {
  const repository = await createProductionFurnishingHandoffRepository();
  return {
    repository,
    createOrReplayHandoff: repository.createOrReplay.bind(repository),
    startOrResumeSession: repository.startOrResume.bind(repository),
    activateProject: repository.activateProject.bind(repository),
    transitionRecovery: repository.transitionRecovery.bind(repository),
  };
}
