import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Acquisition Workspace production query boundary", () => {
  it("keeps application contracts independent of persistence, Supabase, Next.js, and React", () => {
    const application = [
      "src/features/investment-opportunity/acquisition-workspace/application/contracts.ts",
      "src/features/investment-opportunity/acquisition-workspace/application/projections.ts",
      "src/features/investment-opportunity/acquisition-workspace/application/get-acquisition-workspace.ts",
    ].map(read).join("\n");
    expect(application).not.toMatch(/supabase|from ["']next|from ["']react|infrastructure\/persistence/i);
  });

  it("keeps repository and production composition imports out of the handler", () => {
    const handler = read("src/features/investment-opportunity/acquisition-workspace/infrastructure/get-acquisition-workspace-handler.ts");
    expect(handler).not.toMatch(/Supabase|Repository|persistence row|route-handler|server action/i);
    expect(handler).toContain("getAcquisitionWorkspace");
  });

  it("contains no UI, route handler, server action, or database migration in the production boundary", () => {
    const production = [
      "src/features/investment-opportunity/acquisition-workspace/infrastructure/production-readers.ts",
      "src/features/investment-opportunity/acquisition-workspace/infrastructure/production-authorization.ts",
      "src/features/investment-opportunity/acquisition-workspace/infrastructure/production-observability.ts",
      "src/features/investment-opportunity/acquisition-workspace/infrastructure/get-acquisition-workspace-handler.ts",
      "src/features/investment-opportunity/acquisition-workspace/infrastructure/production-composition.ts",
    ].map(read).join("\n");
    expect(production).not.toMatch(/from ["']react|from ["']next|use server|create table|alter table/i);
  });

  it("keeps document handling availability-only", () => {
    const composition = read("src/features/investment-opportunity/acquisition-workspace/infrastructure/production-composition.ts");
    expect(composition).toContain("documentReaderAvailable: false");
    expect(composition).not.toMatch(/documentTitle|mimeType|storageUrl|fileSize/);
  });
});
