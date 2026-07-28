import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("COM-002A Hospitable message sync trigger", () => {
  it("connects the admin control to the message sync endpoint", () => {
    const control = read(
      "src/features/integrations/components/sync-messages-button.tsx",
    );

    expect(control).toContain(
      '"/api/admin/integrations/hospitable/messages/sync"',
    );
    expect(control).toContain("router.refresh()");
    expect(control).toContain("reservations");
    expect(control).toContain("processed");
    expect(control).toContain("created");
    expect(control).toContain("skipped");
    expect(control).toContain("failed");
  });

  it("loads message runs and exposes running state to the control", () => {
    const dashboard = read(
      "src/features/integrations/lib/get-integrations-dashboard.ts",
    );
    const card = read(
      "src/features/integrations/components/integration-card.tsx",
    );

    expect(dashboard).toContain('.eq("sync_type", "messages")');
    expect(dashboard).toContain("messageSyncRunning");
    expect(card).toContain("SyncMessagesButton");
    expect(card).toContain("integration.messageSyncRunning");
  });
});
