import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260828010000_beta_email_auth_operations.sql");
const webhook = read("src/app/api/webhooks/resend/route.ts");
const admin = read("src/app/(admin)/admin/auth-email/page.tsx");

describe("BETA-EMAIL-001 delivery operations", () => {
  it("authenticates the raw webhook before parsing and bounds replay age", () => {
    expect(webhook.indexOf("request.text()")).toBeLessThan(webhook.indexOf(".verify(raw"));
    for (const header of ["svix-id","svix-timestamp","svix-signature"]) expect(webhook).toContain(header);
    expect(webhook).toContain("age > 300");
    expect(webhook).not.toMatch(/console\.(?:log|info|error)/);
  });

  it("deduplicates provider events and rejects changed replays transactionally", () => {
    expect(migration).toContain("provider_event_id text not null unique");
    expect(migration).toContain("AUTH_EMAIL_WEBHOOK_REPLAY_MISMATCH");
    expect(migration).toContain("for update");
    expect(migration).toContain("processing_status in ('processed','unsupported','rejected')");
  });

  it("normalizes lifecycle events and applies bounded suppression and alerts", () => {
    for (const status of ["sent","delivered","delivery_delayed","bounced_soft","bounced_hard","complained","rejected","failed"]) expect(migration).toContain(status);
    expect(migration).toContain("v_soft_count>=3");
    expect(migration).toContain("auth_email_suppressions");
    expect(migration).toContain("auth_email_operational_alerts");
    expect(migration).toContain("AUTH_EMAIL_SUPPRESSION_ADMIN_REQUIRED");
  });

  it("exposes only sanitized operational projections to canonical Admins", () => {
    expect(migration.match(/using \(public\.is_admin\(\)\)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(migration).toMatch(/revoke all on[\s\S]*public\.auth_email_webhook_receipts[\s\S]*from anon/);
    expect(admin).toContain("Delivery means provider delivery, not message open");
    expect(admin).not.toMatch(/token|secret|recipient_email/i);
  });
});
