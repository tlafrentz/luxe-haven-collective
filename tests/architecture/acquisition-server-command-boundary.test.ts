import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
describe("Acquisition server command architecture", () => {
  it("marks auth/composition runtime server-only and actions as Server Actions", () => {
    expect(read("src/app/actions/acquisition-workspace-command-runtime.ts")).toContain('import "server-only"');
    expect(read("src/app/actions/acquisition-workspace-commands.ts")).toMatch(/^"use server"/);
  });

  it("keeps trusted identities and command metadata out of public transport", () => {
    const contracts = read("src/features/investment-opportunity/acquisition-server/contracts.ts");
    const envelope = contracts.slice(contracts.indexOf("export type AcquisitionServerCommandEnvelope"), contracts.indexOf("export type AcquisitionMoneyInput"));
    expect(envelope).not.toMatch(/ownerId|actorId|commandId|requestedAt|correlationId|role/);
    expect(envelope).toContain("idempotencyKey");
    expect(envelope).toContain("expectedOpportunityVersion");
  });

  it("contains no direct persistence, Supabase, React, aggregate result, or generic public dispatcher", () => {
    const actions = read("src/app/actions/acquisition-workspace-commands.ts");
    const executor = read("src/features/investment-opportunity/acquisition-server/executor.ts");
    expect(actions).not.toMatch(/supabase|Repository/i);
    expect(actions).not.toContain("insert(");
    expect(actions).not.toContain("update(");
    expect(actions).not.toContain("delete(");
    expect(executor).not.toMatch(/supabase|persistence row|from ["']react/i);
    expect(actions).not.toMatch(/export async function executeCommand/);
    expect(read("src/features/investment-opportunity/acquisition-server/contracts.ts")).not.toMatch(/AcquisitionPipeline>|PersistenceRow|Supabase/);
  });

  it("centralizes rollout, errors, revalidation, and composition", () => {
    expect(read("src/features/investment-opportunity/acquisition-server/deployment-registry.ts")).toContain("createFailClosedAcquisitionCommandRegistry");
    expect(read("src/features/investment-opportunity/acquisition-server/error-mapper.ts")).toContain("mapAcquisitionServerCommandError");
    expect(read("src/features/investment-opportunity/acquisition-server/revalidation.ts")).toContain("acquisitionCommandRevalidationPaths");
    expect(read("src/app/actions/acquisition-workspace-command-runtime.ts")).toContain("createAcquisitionServerCommandBoundary");
  });
});
