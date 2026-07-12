import { createAdminClient } from "@/lib/supabase/admin";

import type { HospitableProperty } from "../types";

import { getAllHospitableProperties } from "./properties";

const PROVIDER = "hospitable";
const CONNECTION_NAME = "Hospitable Primary";

const PROPERTY_LINKS: Record<string, string> = {
  "676a35c9-7d07-44af-ae44-90a242e4b297":
    "mesa-downtown-retreat",
};

type IntegrationConnectionRow = {
  id: string;
};

type LocalPropertyRow = {
  id: string;
  slug: string;
};

export type PropertySyncResult = {
  connectionId: string;
  processed: number;
  linked: number;
  pending: number;
  failed: number;
  errors: string[];
};

async function getOrCreateConnection(): Promise<
  IntegrationConnectionRow
> {
  const supabase = createAdminClient();

  const { data: existing, error: selectError } =
    await supabase
      .from("integration_connections")
      .select("id")
      .eq("provider", PROVIDER)
      .eq("name", CONNECTION_NAME)
      .maybeSingle();

  if (selectError) {
    throw new Error(
      `Unable to load Hospitable connection: ${selectError.message}`,
    );
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: insertError } =
    await supabase
      .from("integration_connections")
      .insert({
        provider: PROVIDER,
        name: CONNECTION_NAME,
        status: "active",
        metadata: {
          authentication: "personal_access_token",
          access_mode: "read_only",
        },
      })
      .select("id")
      .single();

  if (insertError) {
    throw new Error(
      `Unable to create Hospitable connection: ${insertError.message}`,
    );
  }

  return created;
}

async function findLocalProperty(
  slug: string,
): Promise<LocalPropertyRow | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("properties")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to find local property "${slug}": ${error.message}`,
    );
  }

  return data;
}

async function upsertExternalProperty({
  connectionId,
  source,
  localProperty,
}: {
  connectionId: string;
  source: HospitableProperty;
  localProperty: LocalPropertyRow | null;
}): Promise<"linked" | "pending"> {
  const supabase = createAdminClient();

  const syncStatus = localProperty
    ? "linked"
    : "pending";

  const { error } = await supabase
    .from("external_properties")
    .upsert(
      {
        connection_id: connectionId,
        property_id: localProperty?.id ?? null,
        provider: PROVIDER,
        external_id: source.id,
        external_name: source.name,
        sync_status: syncStatus,
        raw_payload: source,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict:
          "connection_id,external_id",
      },
    );

  if (error) {
    throw new Error(
      `Unable to sync Hospitable property "${source.name}": ${error.message}`,
    );
  }

  return syncStatus;
}

async function startSyncRun(
  connectionId: string,
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("integration_sync_runs")
    .insert({
      connection_id: connectionId,
      sync_type: "properties",
      status: "running",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `Unable to start property sync run: ${error.message}`,
    );
  }

  return data.id;
}

async function finishSyncRun({
  syncRunId,
  result,
}: {
  syncRunId: string;
  result: PropertySyncResult;
}): Promise<void> {
  const supabase = createAdminClient();

  const status =
    result.failed === 0
      ? "completed"
      : result.processed === result.failed
        ? "failed"
        : "partial";

  const { error } = await supabase
    .from("integration_sync_runs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      records_processed: result.processed,
      records_created: 0,
      records_updated:
        result.linked + result.pending,
      records_failed: result.failed,
      error_message:
        result.errors.length > 0
          ? result.errors.join("\n")
          : null,
      metadata: {
        linked: result.linked,
        pending: result.pending,
      },
    })
    .eq("id", syncRunId);

  if (error) {
    throw new Error(
      `Unable to finish property sync run: ${error.message}`,
    );
  }
}

async function markConnectionSynced(
  connectionId: string,
): Promise<void> {
  const supabase = createAdminClient();

  const timestamp = new Date().toISOString();

  const { error } = await supabase
    .from("integration_connections")
    .update({
      status: "active",
      last_synced_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", connectionId);

  if (error) {
    throw new Error(
      `Unable to update Hospitable connection: ${error.message}`,
    );
  }
}

export async function syncHospitableProperties(): Promise<PropertySyncResult> {
  const connection =
    await getOrCreateConnection();

  const syncRunId = await startSyncRun(
    connection.id,
  );

  const result: PropertySyncResult = {
    connectionId: connection.id,
    processed: 0,
    linked: 0,
    pending: 0,
    failed: 0,
    errors: [],
  };

  try {
    const hospitableProperties =
      await getAllHospitableProperties();

    for (const source of hospitableProperties) {
      result.processed += 1;

      try {
        const localSlug =
          PROPERTY_LINKS[source.id];

        const localProperty = localSlug
          ? await findLocalProperty(localSlug)
          : null;

        const syncStatus =
          await upsertExternalProperty({
            connectionId: connection.id,
            source,
            localProperty,
          });

        if (syncStatus === "linked") {
          result.linked += 1;
        } else {
          result.pending += 1;
        }
      } catch (error) {
        result.failed += 1;

        result.errors.push(
          error instanceof Error
            ? error.message
            : "Unknown property sync error.",
        );
      }
    }

    await markConnectionSynced(connection.id);
    await finishSyncRun({
      syncRunId,
      result,
    });

    return result;
  } catch (error) {
    result.errors.push(
      error instanceof Error
        ? error.message
        : "Unknown Hospitable sync error.",
    );

    if (result.failed === 0) {
      result.failed = Math.max(
        1,
        result.processed,
      );
    }

    await finishSyncRun({
      syncRunId,
      result,
    });

    throw error;
  }
}
