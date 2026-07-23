import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(process.cwd(), "src"), files = (folder: string) => execFileSync("find", [resolve(root, folder), "-type", "f", "-name", "*.ts"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const imports = (folder: string) => files(folder).map(file => ({ file, source: readFileSync(file, "utf8") }));

describe("Investment Opportunity architecture boundary", () => {
  it.each(["features/investment-intelligence", "features/market-intelligence", "platform"])("%s does not depend on Opportunity", folder => { for (const item of imports(folder)) expect(item.source, item.file).not.toMatch(/features\/investment-opportunity/); });
  it("domain has no infrastructure, presentation, Supabase, or RentCast imports", () => { for (const item of imports("features/investment-opportunity/domain")) expect(item.source, item.file).not.toMatch(/infrastructure|components|@supabase|rentcast/i); });
  it("application has no presentation, provider, or Supabase imports", () => { for (const item of imports("features/investment-opportunity/application")) expect(item.source, item.file).not.toMatch(/components|rentcast|@supabase/i); });
  it("public feature root does not expose persistence mappers", () => expect(readFileSync(resolve(root, "features/investment-opportunity/index.ts"), "utf8")).not.toMatch(/mappers/));
});
