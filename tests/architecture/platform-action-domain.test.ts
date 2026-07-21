import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTION_STATUSES, PlatformAction, createActionId, createWorkspaceId } from "../../src/platform/actions";

const root = process.cwd();
const actionRoot = join(root, "src/platform/actions");
const featureRoot = join(root, "src/features");
const actor = { type: "system", id: "architecture-test" } as const;
const at = new Date("2026-07-20T12:00:00.000Z");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

function createAction() {
  return PlatformAction.createDraft({ id: createActionId("architecture-action"), workspaceId: createWorkspaceId("workspace-1"), title: "Verify architecture", priority: "normal", owner: actor, sources: [{ type: "manual", recordedAt: at, recordedBy: actor }], createdAt: at, createdBy: actor });
}

describe("PF-009 Platform Action architecture", () => {
  it("does not import feature modules from the Platform Action package", () => {
    const violations = sourceFiles(actionRoot).filter((file) => /(?:@\/features|\.\.\/\.\.\/features|src\/features)/.test(readFileSync(file, "utf8"))).map((file) => relative(root, file));
    expect(violations).toEqual([]);
  });

  it("does not define a competing PlatformAction aggregate in a feature", () => {
    const violations = sourceFiles(featureRoot).filter((file) => /\b(?:class|interface|type)\s+PlatformAction\b/.test(readFileSync(file, "utf8"))).map((file) => relative(root, file));
    expect(violations).toEqual([]);
  });

  it("keeps measured, learning, and Outcome metrics outside the canonical aggregate", () => {
    expect(ACTION_STATUSES).not.toContain("measured");
    const canonicalSource = readFileSync(join(actionRoot, "domain/action.ts"), "utf8");
    expect(canonicalSource).not.toMatch(/lessonsLearned|measuredImpact|ActionOutcome\b/);
  });

  it("requires workspace scope and provenance", () => {
    expect(() => PlatformAction.createDraft({ id: createActionId("missing-source"), workspaceId: createWorkspaceId("workspace-1"), title: "Missing source", priority: "normal", owner: actor, sources: [], createdAt: at, createdBy: actor })).toThrow();
    expect(() => PlatformAction.createDraft({ id: createActionId("missing-workspace"), workspaceId: createWorkspaceId(" "), title: "Missing workspace", priority: "normal", owner: actor, sources: [{ type: "manual", recordedAt: at, recordedBy: actor }], createdAt: at, createdBy: actor })).toThrow();
  });

  it("versions, records, and immutably applies every state change", () => {
    const before = createAction();
    const after = before.commit({ workspaceId: before.workspaceId, expectedVersion: before.version, actor, occurredAt: new Date("2026-07-20T12:01:00.000Z") });
    expect(before.status).toBe("draft"); expect(before.version.value).toBe(1); expect(before.history).toHaveLength(1);
    expect(after.status).toBe("committed"); expect(after.version.value).toBe(2); expect(after.history).toHaveLength(2); expect(after).not.toBe(before);
  });
});
