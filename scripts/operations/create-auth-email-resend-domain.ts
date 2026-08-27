import { Resend } from "resend";

const domainName = "auth.luxehavencollective.co";

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY_REQUIRED");
  const resend = new Resend(apiKey);

  const existing = await resend.domains.list();
  if (existing.error)
    throw new Error(`RESEND_DOMAIN_LIST_FAILED:${existing.error.name}`);

  const match = existing.data?.data.find(({ name }) => name === domainName);
  if (process.argv.includes("--verify")) {
    if (!match) throw new Error("RESEND_AUTH_DOMAIN_NOT_FOUND");
    const verification = await resend.domains.verify(match.id);
    if (verification.error)
      throw new Error(`RESEND_DOMAIN_VERIFY_FAILED:${verification.error.name}`);
    const detail = await resend.domains.get(match.id);
    if (detail.error)
      throw new Error(`RESEND_DOMAIN_READ_FAILED:${detail.error.name}`);
    process.stdout.write(
      `${JSON.stringify({ id: match.id, name: domainName, verificationRequested: true, status: detail.data?.status, records: (detail.data?.records ?? []).map((record) => ({ record: record.record, type: record.type, name: record.name, status: record.status })) }, null, 2)}\n`,
    );
    return;
  }
  const result = match
    ? await resend.domains.get(match.id)
    : await resend.domains.create({
        name: domainName,
        region: "us-east-1",
        customReturnPath: "bounce",
        capabilities: { sending: "enabled", receiving: "disabled" },
        openTracking: false,
        clickTracking: false,
        tls: "enforced",
      });
  if (result.error)
    throw new Error(`RESEND_DOMAIN_CREATE_FAILED:${result.error.name}`);

  process.stdout.write(
    `${JSON.stringify(
      {
        operation: match ? "existing" : "created",
        id: result.data?.id,
        name: result.data?.name,
        status: result.data?.status,
        region: result.data?.region,
        capabilities: result.data?.capabilities,
        openTracking: result.data?.open_tracking ?? false,
        clickTracking: result.data?.click_tracking ?? false,
        trackingSubdomainConfigured: Boolean(result.data?.tracking_subdomain),
        records: (result.data?.records ?? []).map((record) => ({
          record: record.record,
          type: record.type,
          name: record.name,
          value: record.value,
          ttl: record.ttl,
          priority: "priority" in record ? record.priority : null,
          status: record.status,
        })),
      },
      null,
      2,
    )}\n`,
  );
}

void main();
