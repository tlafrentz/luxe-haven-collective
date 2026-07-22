import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const provider = join(root, "src/platform/actions/application/default-platform-action-provider.ts");
const features = join(root, "src/features");
function sourceFiles(directory: string): string[] { return readdirSync(directory).flatMap((name) => { const path = join(directory, name); return statSync(path).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(path) ? [path] : []; }); }

describe("PF-009 Platform Action provider architecture", () => {
  it("depends only on application repository and domain contracts", () => {
    const source = readFileSync(provider, "utf8");
    expect(source).not.toMatch(/supabase|infrastructure|@\/features|src\/features/);
    expect(source).toContain('from "./action-provider"');
    expect(source).toContain('from "./platform-action-provider-dependencies"');
    expect(source).toContain('from "../domain"');
  });
  it("does not wire feature consumers or expose repositories to features", () => {
    const violations = sourceFiles(features).filter((file) => /platform\/actions\/(?:application\/)?action-repository|PlatformActionRepository/.test(readFileSync(file, "utf8"))).map((file) => relative(root, file));
    expect(violations).toEqual([]);
  });
});
