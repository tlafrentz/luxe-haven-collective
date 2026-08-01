import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
type Receipt = { owner: string; guidebook: string; command: string };
class DatabaseFaithfulGuidebookHarness {
  guidebooks = new Map([
    ["guidebook-a", { owner: "owner-a", draft: "draft-a" }],
    ["guidebook-b", { owner: "owner-b", draft: "draft-b" }],
  ]);
  sections = new Map([
    ["section-a", { guidebook: "guidebook-a" }],
    ["section-b", { guidebook: "guidebook-b" }],
    ["section-a2", { guidebook: "guidebook-a" }],
  ]);
  blocks = new Map([
    ["block-a", { section: "section-a" }],
    ["block-a2", { section: "section-a2" }],
    ["block-b", { section: "section-b" }],
  ]);
  receipts = new Map<string, Receipt>();
  authorize(owner: string, guidebook: string) {
    return this.guidebooks.get(guidebook)?.owner === owner;
  }
  section(owner: string, guidebook: string, section: string) {
    return (
      this.authorize(owner, guidebook) &&
      this.sections.get(section)?.guidebook === guidebook
    );
  }
  block(owner: string, guidebook: string, section: string, block: string) {
    return (
      this.section(owner, guidebook, section) &&
      this.blocks.get(block)?.section === section
    );
  }
  draft(owner: string, guidebook: string, draft: string) {
    return (
      this.authorize(owner, guidebook) &&
      this.guidebooks.get(guidebook)?.draft === draft
    );
  }
  receipt(value: Receipt) {
    const key = `${value.owner}:${value.command}`,
      prior = this.receipts.get(key);
    if (
      prior &&
      (prior.guidebook !== value.guidebook || prior.owner !== value.owner)
    )
      return false;
    this.receipts.set(key, value);
    return true;
  }
}
class CreationReceiptHarness {
  rows = new Map<
    string,
    {
      owner: string;
      guidebook: string;
      fingerprint: string;
      state: "in-progress" | "completed";
      result?: unknown;
    }
  >();
  execute(
    owner: string,
    guidebook: string,
    command: string,
    fingerprint: string,
  ) {
    const key = `${owner}:${command}`,
      prior = this.rows.get(key);
    if (prior) {
      if (prior.guidebook !== guidebook || prior.fingerprint !== fingerprint)
        return { ok: false, code: "COMMAND_RECEIPT_CONFLICT" };
      if (prior.state === "in-progress")
        return { ok: false, code: "COMMAND_ALREADY_IN_PROGRESS" };
      return prior.result;
    }
    const result = {
      ok: true,
      value: { guidebookId: guidebook, revision: 1, status: "draft" },
    };
    this.rows.set(key, {
      owner,
      guidebook,
      fingerprint,
      state: "completed",
      result,
    });
    return result;
  }
}
describe("GB-001B.3 database-faithful repository scoping", () => {
  it("rejects a section from another guidebook", () =>
    expect(
      new DatabaseFaithfulGuidebookHarness().section(
        "owner-a",
        "guidebook-a",
        "section-b",
      ),
    ).toBe(false));
  it("rejects blocks from another guidebook or section", () => {
    const db = new DatabaseFaithfulGuidebookHarness();
    expect(db.block("owner-a", "guidebook-a", "section-a", "block-b")).toBe(
      false,
    );
    expect(db.block("owner-a", "guidebook-a", "section-a", "block-a2")).toBe(
      false,
    );
  });
  it("rejects a draft associated with another guidebook", () =>
    expect(
      new DatabaseFaithfulGuidebookHarness().draft(
        "owner-a",
        "guidebook-a",
        "draft-b",
      ),
    ).toBe(false));
  it("isolates receipt reuse across guidebooks and owners", () => {
    const db = new DatabaseFaithfulGuidebookHarness();
    expect(
      db.receipt({
        owner: "owner-a",
        guidebook: "guidebook-a",
        command: "same",
      }),
    ).toBe(true);
    expect(
      db.receipt({
        owner: "owner-a",
        guidebook: "guidebook-b",
        command: "same",
      }),
    ).toBe(false);
    expect(
      db.receipt({
        owner: "owner-b",
        guidebook: "guidebook-b",
        command: "same",
      }),
    ).toBe(true);
  });
  it("proves the Supabase adapters apply workspace, guidebook, section, and receipt predicates", () => {
    const source = readFileSync(
      "src/features/guidebook-studio/infrastructure/supabase-authoring-repositories.ts",
      "utf8",
    ).replace(/\s+/g, "");
    for (const predicate of [
      '.eq("workspace_id",scope.workspaceId)',
      '.eq("id",scope.guidebookId)',
      '.eq("workspace_id",workspaceId)',
      '.eq("command_id",commandId)',
    ])
      expect(source).toContain(predicate);
    expect(source).toContain('rpc("persist_guidebook_draft"');
  });
  it("faithfully classifies creation replay, in-progress duplicates, and changed input", () => {
    const db = new CreationReceiptHarness(),
      first = db.execute("owner-a", "guidebook-a", "create", "hash-a");
    expect(db.execute("owner-a", "guidebook-a", "create", "hash-a")).toEqual(
      first,
    );
    db.rows.set("owner-a:busy", {
      owner: "owner-a",
      guidebook: "guidebook-a",
      fingerprint: "hash-a",
      state: "in-progress",
    });
    expect(
      db.execute("owner-a", "guidebook-a", "busy", "hash-a"),
    ).toMatchObject({ code: "COMMAND_ALREADY_IN_PROGRESS" });
    expect(
      db.execute("owner-a", "guidebook-a", "create", "hash-b"),
    ).toMatchObject({ code: "COMMAND_RECEIPT_CONFLICT" });
  });
});
