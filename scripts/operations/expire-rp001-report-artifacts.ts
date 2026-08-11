import { createClient } from "@supabase/supabase-js";
import {
  ExpireReportArtifacts,
  SupabaseReportArtifactStorage,
  SupabaseReportExportRepository,
  parseReportingProductionConfiguration,
} from "../../src/platform/reporting/foundation/index";

async function main(): Promise<void> {
  if (
    process.env.RP001_CLEANUP_CONFIRM_PRODUCTION !==
    "I_CONFIRM_BOUNDED_REPORT_ARTIFACT_CLEANUP"
  )
    throw new Error("Explicit production cleanup confirmation is required.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Server storage configuration is unavailable.");
  const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    configuration = parseReportingProductionConfiguration(process.env),
    correlationId = crypto.randomUUID();
  const result = await new ExpireReportArtifacts({
    repository: new SupabaseReportExportRepository(client),
    storage: new SupabaseReportArtifactStorage(client),
    telemetry: {
      emit: (event, metadata) =>
        console.info(event, {
          correlationId: metadata.correlationId,
          count: metadata.count ?? 0,
          failedCount: metadata.failedCount ?? 0,
        }),
    },
  }).execute({
    asOf: new Date(),
    batchSize: Number(process.env.RP001_CLEANUP_BATCH_SIZE ?? 25),
    correlationId,
  });
  console.log(
    JSON.stringify({
      schemaVersion: 1,
      completedAt: new Date().toISOString(),
      correlationId,
      ...result,
      retentionDays: configuration.exportRetentionDays,
    }),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Cleanup failed.");
  process.exitCode = 1;
});
