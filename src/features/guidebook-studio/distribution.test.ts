import { describe, expect, it, vi } from "vitest";
import {
  rotateGuidebookPublicSlug,
  executeGuidebookMediaGarbageCollection,
  uploadGuidebookMedia,
  type GuidebookCommandReceiptRepository,
  type GuidebookMediaRepository,
  type GuidebookSlugRepository,
} from "./index";
const context = {
  commandId: "cmd",
  correlationId: "cor",
  actorId: "owner",
  workspaceId: "owner",
  guidebookId: "guide",
  expectedRevision: 1,
  enteredAt: "2026-07-31T00:00:00Z",
};
class Receipts implements GuidebookCommandReceiptRepository {
  value: any = null;
  async find() {
    return this.value;
  }
  async begin(value: any) {
    this.value = value;
    return "started" as const;
  }
  async complete(_w: string, _c: string, outcome: any) {
    this.value = {
      ...this.value,
      state: outcome.ok ? "completed" : "failed",
      outcome,
    };
  }
}
describe("GB-001C distribution commands", () => {
  it("uploads privately once and replays the receipt", async () => {
    const receipts = new Receipts(),
      createUpload = vi.fn(async (input: any) => ({
        id: input.assetId,
        workspaceId: "owner",
        guidebookId: "guide",
        mimeType: "image/webp",
        byteSize: 4,
        authoringPath: "private/path",
        createdAt: context.enteredAt,
      })),
      media = {
        createUpload,
        promote: vi.fn(),
        garbageCollect: vi.fn(),
      } as unknown as GuidebookMediaRepository,
      first = await uploadGuidebookMedia({ media, receipts }, context, {
        mimeType: "image/webp",
        bytes: new ArrayBuffer(4),
      }),
      again = await uploadGuidebookMedia({ media, receipts }, context, {
        mimeType: "image/webp",
        bytes: new ArrayBuffer(4),
      });
    expect(first).toEqual(again);
    expect(createUpload).toHaveBeenCalledOnce();
    expect(first.ok && first.value.id).toMatch(/^gbm_[a-z0-9]{26}$/);
    expect(JSON.stringify(receipts.value)).not.toContain("private/path");
  });
  it("rejects receipt input changes and in-progress duplicates", async () => {
    const receipts = new Receipts(),
      media = {} as GuidebookMediaRepository;
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new ArrayBuffer(4))),
    )
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    receipts.value = {
      workspaceId: "owner",
      guidebookId: "guide",
      commandId: "cmd",
      fingerprint: "different",
      state: "completed",
    };
    await expect(
      uploadGuidebookMedia({ media, receipts }, context, {
        mimeType: "image/webp",
        bytes: new ArrayBuffer(4),
      }),
    ).resolves.toMatchObject({ code: "COMMAND_RECEIPT_CONFLICT" });
    receipts.value = {
      ...receipts.value,
      fingerprint: `guide:image/webp:4:${digest}`,
      state: "in-progress",
    };
    await expect(
      uploadGuidebookMedia({ media, receipts }, context, {
        mimeType: "image/webp",
        bytes: new ArrayBuffer(4),
      }),
    ).resolves.toMatchObject({ code: "COMMAND_ALREADY_IN_PROGRESS" });
  });
  it("rotates a slug once with a redirect expiry", async () => {
    const receipts = new Receipts(),
      rotate = vi.fn(async (input: any) => ({
        slug: input.nextSlug,
        redirectExpiresAt: input.expiresAt,
      })),
      slugs = { rotate } as GuidebookSlugRepository,
      input = { slug: "a".repeat(24), expiresAt: "2026-09-01T00:00:00Z" },
      first = await rotateGuidebookPublicSlug(
        { slugs, receipts },
        context,
        input,
      ),
      again = await rotateGuidebookPublicSlug(
        { slugs, receipts },
        context,
        input,
      );
    expect(first).toEqual(again);
    expect(rotate).toHaveBeenCalledOnce();
  });
  it("classifies never-settling GC and preserves explicit refusal and recoverability results", async () => {
    await expect(
      executeGuidebookMediaGarbageCollection(
        {
          garbageCollect: () => new Promise(() => {}),
        } as unknown as GuidebookMediaRepository,
        { now: context.enteredAt, timeoutMs: 5 },
      ),
    ).rejects.toMatchObject({ code: "MEDIA_GC_TIMEOUT" });
    const result = await executeGuidebookMediaGarbageCollection(
      {
        garbageCollect: async () => ({
          deleted: [],
          refused: ["draft-ref", "version-ref"],
          recoverable: [
            { id: "object-gone", code: "DATABASE_DELETE_AFTER_OBJECT_DELETE" },
          ],
        }),
      } as unknown as GuidebookMediaRepository,
      { now: context.enteredAt },
    );
    expect(result.refused).toEqual(["draft-ref", "version-ref"]);
    expect(result.recoverable).toEqual([
      { id: "object-gone", code: "DATABASE_DELETE_AFTER_OBJECT_DELETE" },
    ]);
  });
});
