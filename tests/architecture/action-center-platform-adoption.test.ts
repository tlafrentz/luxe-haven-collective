import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"; import { join } from "node:path"; import { describe, expect, it } from "vitest";
function files(path: string): string[] { return readdirSync(path).flatMap((name) => { const value = join(path, name); return statSync(value).isDirectory() ? files(value) : /\.(ts|tsx)$/.test(value) ? [value] : []; }); }
describe("Action Center Platform Action adoption", () => {
  const root = join(process.cwd(), "src/features/action-center"); const source = () => files(root).map((file) => readFileSync(file, "utf8")).join("\n");
  it("removes feature-owned Action domain and persistence", () => { const legacy = join(process.cwd(), "src/features/execution-engine"); expect(existsSync(legacy) ? files(legacy) : []).toEqual([]); expect(source()).not.toContain("SupabasePlatformActionRepository"); expect(source()).not.toContain('from "@/lib/supabase'); });
  it("uses the provider contract and no legacy lifecycle", () => { const reader = readFileSync(join(root, "application/action-center-reader.ts"), "utf8"); expect(reader).toContain("PlatformActionProvider"); for (const status of ["proposed", "accepted", "scheduled", "measured", "medium"]) expect(source()).not.toMatch(new RegExp(`['\"]${status}['\"]`)); });
  it("keeps Platform independent of Action Center", () => { const platform = files(join(process.cwd(), "src/platform")).map((file) => readFileSync(file, "utf8")).join("\n"); expect(platform).not.toContain("features/action-center"); });
});
