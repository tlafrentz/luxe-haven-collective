import { createAdminClient } from "@/lib/supabase/admin";

export type MeteredProvider = "rentcast" | "realtyapi" | "airroi";

export async function recordProviderApiCall(provider: MeteredProvider): Promise<void> {
  try {
    await createAdminClient().from("provider_api_call_log").insert({ provider });
  } catch {
    // Usage metering must never affect provider request outcomes.
  }
}

export async function getProviderApiCallCounts(
  client: { from(table: string): { select(columns: string): PromiseLike<{ data: unknown; error: unknown }> } },
): Promise<Readonly<Record<string, number>>> {
  const { data } = await client.from("provider_api_call_counts").select("provider,call_count");
  const rows = (data ?? []) as readonly { provider: string; call_count: number }[];
  return Object.fromEntries(rows.map(({ provider, call_count }) => [provider, Number(call_count)]));
}
