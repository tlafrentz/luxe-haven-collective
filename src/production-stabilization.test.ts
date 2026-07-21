import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("critical production safeguards", () => {
  it("does not override link-button foreground utilities globally", () => {
    const styles = read("src/app/globals.css");
    expect(styles).not.toMatch(/a\s*\{[^}]*color:\s*inherit/);
  });

  it("allows the configured hero image host", () => {
    expect(read("next.config.ts")).toContain('hostname: "images.unsplash.com"');
  });

  it("keeps dashboard and insights under the same route-group shell", () => {
    const dashboardPage = read("src/app/(dashboard)/dashboard/page.tsx");
    const insightsPage = read("src/app/(dashboard)/dashboard/insights/page.tsx");
    const dashboardLayout = read("src/app/(dashboard)/layout.tsx");

    expect(dashboardPage).toContain("getExecutiveIntelligenceView");
    expect(insightsPage).toBeTruthy();
    expect(dashboardLayout).toContain("DashboardShell");
    expect(dashboardLayout).toContain("requireUser");
  });

  it("protects dashboard routes in the active Next proxy", () => {
    const proxy = read("src/lib/supabase/proxy.ts");
    expect(proxy).toContain("isProtectedRoute(pathname)");
    expect(proxy).toContain('url.pathname = "/login"');
  });
});
