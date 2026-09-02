import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sourcePage = readFileSync(
  "src/components/furnishing/delivery-installation-v2.tsx",
  "utf8",
);

describe("FS-UX-009 installation source projection", () => {
  const implementation = sourcePage.slice(
    sourcePage.indexOf("export async function NewTrackingProject"),
    sourcePage.indexOf("export async function TrackingDetail"),
  );

  it("queries the canonical installation relation through the authenticated client", () => {
    expect(implementation).toContain("const db = await createClient()");
    expect(implementation).toContain("furnishing_installation_projects(");
    expect(implementation).not.toContain("fsux7_installation_projects");
  });

  it("shows only current approved and active procurement sources", () => {
    expect(implementation).toContain(
      '.eq("furnishing_procurement_baselines.readiness_status", "approved")',
    );
    expect(implementation).toContain(
      '.is("furnishing_procurement_baselines.archived_at", null)',
    );
    expect(implementation.replace(/\s+/g, " ")).toContain(
      "baseline?.current_readiness_version_id === snapshot.readiness_version_id",
    );
    expect(implementation).toContain('project.tracking_status === "complete"');
    expect(implementation).toContain("project.archived_at !== null");
  });

  it("binds creation to the authoritative readiness snapshot without external effects", () => {
    expect(implementation).toContain(
      '<input type="hidden" name="snapshotId" value={String(s.id)} />',
    );
    expect(sourcePage).toContain(
      "No order or external service action is created here.",
    );
  });
});
