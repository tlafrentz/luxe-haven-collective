import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260726230000_public_guidebook_engagement.sql",
  ),
  "utf8",
);

describe("public guidebook engagement migration", () => {
  it("registers the durable guest engagement events", () => {
    for (const eventType of [
      "view",
      "qr-scan",
      "section-open",
      "link-click",
      "map-open",
      "phone-tap",
      "guidebook-completed",
    ]) {
      expect(migration).toContain(`'${eventType}'`);
    }
  });

  it("stores renderer provenance and privacy-safe session identity", () => {
    expect(migration).toContain("artifact_version");
    expect(migration).toContain("renderer_version");
    expect(migration).toContain("session_hash");
    expect(migration).not.toContain("ip_address");
    expect(migration).toContain("guest_id");
    expect(migration).toContain("reservation_id");
  });
});
