import { syncHospitableProperties } from "../src/features/integrations/hospitable";

async function main() {
  console.log(
    "Starting Hospitable property sync...",
  );

  const result =
    await syncHospitableProperties();

  console.log(
    JSON.stringify(
      {
        connectionId: result.connectionId,
        processed: result.processed,
        linked: result.linked,
        pending: result.pending,
        failed: result.failed,
        errors: result.errors,
      },
      null,
      2,
    ),
  );

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );

  process.exit(1);
});
