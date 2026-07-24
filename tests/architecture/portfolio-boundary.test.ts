import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");
function sources(folder: string): readonly { file: string; source: string }[] {
  const output = execFileSync("find", [resolve(sourceRoot, folder), "-type", "f", "-name", "*.ts"], { encoding: "utf8" }).trim();
  return output ? output.split("\n").map((file) => ({ file, source: readFileSync(file, "utf8") })) : [];
}

describe("Portfolio bounded context", () => {
  it("is not imported by Investment Intelligence or Acquisition OS", () => {
    for (const folder of ["features/investment-intelligence", "features/investment-opportunity"]) {
      for (const item of sources(folder)) expect(item.source, item.file).not.toMatch(/features\/portfolio/);
    }
  });

  it("domain depends only on Portfolio and neutral platform primitives", () => {
    for (const item of sources("features/portfolio/domain")) {
      expect(item.source, item.file).not.toMatch(/features\/(investment-intelligence|investment-opportunity|market-intelligence|revenue-intelligence)/);
      expect(item.source, item.file).not.toMatch(/application|infrastructure|components|presentation|@supabase/i);
    }
  });

  it("application has no presentation or provider dependencies", () => {
    for (const item of sources("features/portfolio/application")) {
      expect(item.source, item.file).not.toMatch(/components|presentation|@supabase|rentcast/i);
    }
  });

  it("introduces no Portfolio UI", () => {
    expect(sources("features/portfolio").some((item) => /\.(tsx|jsx)$/.test(item.file))).toBe(false);
  });
});
