import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const migration = readFileSync("supabase/migrations/20260725150000_workspace_notifications_preferences.sql", "utf8");
describe("Sprint 4E architecture", () => {
  it("separates notification and behavior settings", () => {
    expect(migration).toContain("user_notification_preferences"); expect(migration).toContain("user_workspace_preferences");
  });
  it("enforces recipient and workspace boundaries", () => {
    expect(migration).toContain("recipient_profile_id=auth.uid()"); expect(migration).toContain("active_workspace_role");
    expect(migration).toContain("can_access_workspace_property");
  });
  it("protects critical notification policy and delivery secrecy", () => {
    expect(migration).toContain("Critical notification bypass cannot be disabled");
    expect(migration).not.toMatch(/provider_payload|email_secret|api_key/);
  });
  it("does not deliver during backfill", () => {
    expect(migration.match(/insert into public\\.notifications/g)).toBeNull();
  });
});
