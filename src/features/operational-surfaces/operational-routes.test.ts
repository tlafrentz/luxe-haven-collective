import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("live operational routes", () => {
  it("uses the canonical projection on Home, Properties, and Workspace", () => {
    for (const route of [
      "src/app/(dashboard)/dashboard/page.tsx",
      "src/app/(portal)/properties/page.tsx",
      "src/app/(dashboard)/dashboard/settings/page.tsx",
    ]) {
      expect(read(route)).toContain("getOperationalSurfaceProjection");
    }
  });

  it("keeps provider DTOs and operational sample records out of surfaces", () => {
    const source = [
      read("src/app/(dashboard)/dashboard/page.tsx"),
      read("src/app/(portal)/properties/page.tsx"),
      read("src/app/(portal)/bookings/page.tsx"),
    ].join("\n");
    expect(source).not.toMatch(/HospitableReservation|external_guest_id|raw_payload/);
    expect(source).not.toMatch(/Mesa Downtown Retreat|Urban Haven Suite/);
  });

  it("defines loading and error recovery for every primary operational route", () => {
    for (const path of [
      "src/app/(dashboard)/dashboard/loading.tsx",
      "src/app/(dashboard)/dashboard/error.tsx",
      "src/app/(portal)/properties/loading.tsx",
      "src/app/(portal)/properties/error.tsx",
      "src/app/(portal)/bookings/loading.tsx",
      "src/app/(portal)/bookings/error.tsx",
    ]) {
      expect(read(path)).toBeTruthy();
    }
  });

  it("reuses one context selector rather than page-specific property selectors", () => {
    const home = read("src/app/(dashboard)/dashboard/page.tsx");
    const properties = read("src/app/(portal)/properties/page.tsx");
    const bookings = read(
      "src/features/bookings/presentation/booking-workspace.tsx",
    );
    for (const source of [home, properties, bookings])
      expect(source).toContain("OperationalContextBar");
  });
});
