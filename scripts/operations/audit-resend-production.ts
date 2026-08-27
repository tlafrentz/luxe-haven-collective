import { Resend } from "resend";

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY_REQUIRED");

  const resend = new Resend(apiKey);
  const [domainList, keyList, webhookList] = await Promise.all([
    resend.domains.list(),
    resend.apiKeys.list(),
    resend.webhooks.list(),
  ]);
  const failures = [
    ["domains", domainList.error],
    ["apiKeys", keyList.error],
    ["webhooks", webhookList.error],
  ].filter((entry) => entry[1]);
  if (failures.length)
    throw new Error(
      `RESEND_AUDIT_FAILED:${failures.map(([boundary, failure]) => `${boundary}:${(failure as { name: string; message?: string }).name}:${(failure as { message?: string }).message ?? "unspecified"}`).join(",")}:KEY_FORMAT:${JSON.stringify({ length: apiKey.length, expectedPrefix: apiKey.startsWith("re_"), leadingWhitespace: /^\s/.test(apiKey), trailingWhitespace: /\s$/.test(apiKey), wrappedInQuotes: /^["']/.test(apiKey) && /["']$/.test(apiKey) })}`,
    );

  const domains = await Promise.all(
    (domainList.data?.data ?? []).map(async (domain) => {
      const detail = await resend.domains.get(domain.id);
      if (detail.error)
        throw new Error(`RESEND_DOMAIN_AUDIT_FAILED:${detail.error.name}`);
      return {
        id: domain.id,
        name: domain.name,
        status: domain.status,
        region: domain.region,
        createdAt: domain.created_at,
        capabilities: detail.data?.capabilities ?? null,
        openTracking: detail.data?.open_tracking ?? false,
        clickTracking: detail.data?.click_tracking ?? false,
        trackingSubdomainConfigured: Boolean(detail.data?.tracking_subdomain),
        records: (detail.data?.records ?? []).map((record) => ({
          record: record.record,
          name: record.name,
          type: record.type,
          status: record.status,
        })),
      };
    }),
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        domains,
        apiKeys: (keyList.data?.data ?? []).map((key) => ({
          id: key.id,
          name: key.name,
          createdAt: key.created_at,
        })),
        webhooks: (webhookList.data?.data ?? []).map((webhook) => ({
          id: webhook.id,
          endpoint: new URL(webhook.endpoint).origin,
          status: webhook.status,
          events: webhook.events,
          createdAt: webhook.created_at,
        })),
      },
      null,
      2,
    )}\n`,
  );
}

void main();
