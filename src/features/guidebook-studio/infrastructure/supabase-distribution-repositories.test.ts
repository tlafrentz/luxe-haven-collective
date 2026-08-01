import { describe, expect, it, vi } from "vitest";
import { SupabaseGuidebookMediaRepository } from "./supabase-distribution-repositories";

const context = {
  actorId: "actor-owner",
  workspaceId: "workspace-owner",
  guidebookId: "guidebook-owner",
  correlationId: "correlation",
  commandId: "command",
  expectedRevision: 1,
  enteredAt: "2026-07-31T00:00:00Z",
};

type Response = { data?: unknown; error?: unknown; count?: number };

function clientFixture(input: {
  mediaAssets: Response[];
  versionCounts?: number[];
  draftCounts?: number[];
  storage?: Record<string, Response[]>;
}) {
  const mediaAssets = [...input.mediaAssets];
  const versionCounts = [...(input.versionCounts ?? [])];
  const draftCounts = [...(input.draftCounts ?? [])];
  const storage = Object.fromEntries(
    Object.entries(input.storage ?? {}).map(([key, values]) => [
      key,
      [...values],
    ]),
  );
  const calls: string[] = [];
  const from = vi.fn((table: string) => {
    let action = "select";
    const query: Record<string, unknown> = {};
    for (const method of ["eq", "in", "lt", "not", "limit"])
      query[method] = vi.fn(() => query);
    query.select = vi.fn(() => {
      action = "select";
      return query;
    });
    query.update = vi.fn(() => {
      action = "update";
      return query;
    });
    query.delete = vi.fn(() => {
      action = "delete";
      return query;
    });
    query.then = (resolve: (value: Response) => void) => {
      calls.push(`${table}:${action}`);
      if (table === "guidebook_version_media")
        return Promise.resolve(resolve({ count: versionCounts.shift() ?? 0 }));
      if (table === "guidebook_draft_media")
        return Promise.resolve(resolve({ count: draftCounts.shift() ?? 0 }));
      return Promise.resolve(
        resolve(mediaAssets.shift() ?? { data: null, error: null }),
      );
    };
    return query;
  });
  const storageApi = {
    from: vi.fn((bucket: string) => ({
      download: vi.fn(async () => {
        calls.push(`${bucket}:download`);
        const response = storage[`${bucket}:download`]?.shift() ?? {};
        return {
          data:
            response.data ??
            ({ arrayBuffer: async () => new ArrayBuffer(1) } as Blob),
          error: response.error ?? null,
        };
      }),
      upload: vi.fn(async () => {
        calls.push(`${bucket}:upload`);
        return storage[`${bucket}:upload`]?.shift() ?? { error: null };
      }),
      remove: vi.fn(async () => {
        calls.push(`${bucket}:remove`);
        return storage[`${bucket}:remove`]?.shift() ?? { error: null };
      }),
      getPublicUrl: vi.fn((path: string) => ({
        data: { publicUrl: `https://media.example/${path}` },
      })),
    })),
  };
  return { client: { from, storage: storageApi }, calls };
}

describe("SupabaseGuidebookMediaRepository failure semantics", () => {
  it("cleans only newly copied objects after partial promotion and preserves the original error", async () => {
    const fixture = clientFixture({
      mediaAssets: [
        {
          data: [
            {
              id: "existing",
              mime_type: "image/png",
              authoring_path: "private/existing",
              public_delivery_path: "public/existing",
            },
            {
              id: "new-one",
              mime_type: "image/png",
              authoring_path: "private/one",
              public_delivery_path: null,
            },
            {
              id: "new-two",
              mime_type: "image/png",
              authoring_path: "private/two",
              public_delivery_path: null,
            },
          ],
          error: null,
        },
        { error: null },
        {
          data: [
            { id: "new-one", public_delivery_path: "guidebook-owner/new-one" },
          ],
        },
        { error: null },
      ],
      storage: {
        "guidebook-public-media:upload": [
          { error: null },
          { error: new Error("second copy failed") },
        ],
      },
    });
    const repository = new SupabaseGuidebookMediaRepository(
      fixture.client as never,
    );
    await expect(
      repository.promote({
        context,
        mediaIds: ["existing", "new-one", "new-two"],
      }),
    ).rejects.toMatchObject({
      message: "second copy failed",
      code: "MEDIA_PROMOTION_FAILED",
      cleanupFailed: [],
    });
    expect(
      fixture.calls.filter((call) => call === "guidebook-public-media:remove"),
    ).toHaveLength(1);
  });

  it("reports cleanup failure without masking the promotion failure", async () => {
    const fixture = clientFixture({
      mediaAssets: [
        {
          data: [
            {
              id: "one",
              mime_type: "image/png",
              authoring_path: "private/one",
              public_delivery_path: null,
            },
            {
              id: "two",
              mime_type: "image/png",
              authoring_path: "private/two",
              public_delivery_path: null,
            },
          ],
        },
        { error: null },
        { data: [{ id: "one", public_delivery_path: "guidebook-owner/one" }] },
      ],
      storage: {
        "guidebook-public-media:upload": [
          { error: null },
          { error: new Error("copy failed") },
        ],
        "guidebook-public-media:remove": [
          { error: new Error("cleanup failed") },
        ],
      },
    });
    const repository = new SupabaseGuidebookMediaRepository(
      fixture.client as never,
    );
    await expect(
      repository.promote({ context, mediaIds: ["one", "two"] }),
    ).rejects.toMatchObject({
      message: "copy failed",
      cleanupFailed: ["one"],
    });
  });

  it("refuses draft and historical references before touching storage", async () => {
    const fixture = clientFixture({
      mediaAssets: [
        {
          data: [
            { id: "draft", authoring_path: "private/draft" },
            { id: "history", authoring_path: "private/history" },
          ],
        },
      ],
      versionCounts: [0, 1],
      draftCounts: [1, 0],
    });
    const repository = new SupabaseGuidebookMediaRepository(
      fixture.client as never,
    );
    const result = await repository.garbageCollect({
      now: "2026-07-31T00:00:00Z",
      graceHours: 24,
      limit: 10,
    });
    expect(result).toMatchObject({
      deleted: [],
      refused: ["draft", "history"],
    });
    expect(fixture.calls.some((call) => call.endsWith(":remove"))).toBe(false);
  });

  it("classifies storage and post-object database deletion failures for idempotent recovery", async () => {
    const storageFailure = clientFixture({
      mediaAssets: [
        { data: [{ id: "orphan", authoring_path: "private/orphan" }] },
      ],
      storage: {
        "guidebook-authoring-media:remove": [{ error: new Error("timeout") }],
      },
    });
    const first = await new SupabaseGuidebookMediaRepository(
      storageFailure.client as never,
    ).garbageCollect({
      now: "2026-07-31T00:00:00Z",
      graceHours: 24,
      limit: 10,
    });
    expect(first.recoverable).toEqual([
      { id: "orphan", code: "STORAGE_DELETE_FAILED" },
    ]);

    const databaseFailure = clientFixture({
      mediaAssets: [
        { data: [{ id: "orphan", authoring_path: "private/orphan" }] },
        { error: new Error("database unavailable") },
      ],
    });
    const second = await new SupabaseGuidebookMediaRepository(
      databaseFailure.client as never,
    ).garbageCollect({
      now: "2026-07-31T00:00:00Z",
      graceHours: 24,
      limit: 10,
    });
    expect(second.recoverable).toEqual([
      { id: "orphan", code: "DATABASE_DELETE_AFTER_OBJECT_DELETE" },
    ]);
    expect(second.deleted).toEqual([]);
  });
});
