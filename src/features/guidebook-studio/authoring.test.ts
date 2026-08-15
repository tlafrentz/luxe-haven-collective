import { describe, expect, it } from "vitest";
import {
  createGuidebookBlock,
  createGuidebookSection,
  deleteGuidebookBlock,
  deleteGuidebookSection,
  duplicateGuidebookBlock,
  duplicateGuidebookSection,
  loadGuidebookEngagementSummary,
  moveGuidebookMediaToSection,
  publishGuidebookVersion,
  reorderGuidebookBlocks,
  reorderGuidebookSections,
  renameGuidebookSection,
  restoreGuidebookSections,
  setGuidebookBlockVisibility,
  setGuidebookSectionVisibility,
  updateGuidebookBlock,
  updateGuidebookBrand,
  updateGuidebookDetails,
  type AuthoringDependencies,
  type AuthoringResult,
  type CommandContext,
  type GuidebookCommandReceiptRepository,
  type GuidebookDraftRepository,
  type Receipt,
} from "./application/authoring";
import {
  GUIDEBOOK_BLOCK_SCHEMA,
  GUIDEBOOK_DRAFT_SCHEMA,
  buildMediaDimensionMap,
  buildSnapshot,
  evaluateReadiness,
  initialBlock,
  validateBlock,
  type AuthoringBlock,
  type GuidebookDraft,
  type HeadingBlock,
} from "./domain/authoring";

const now = "2026-07-31T12:00:00.000Z";
function draft(): GuidebookDraft {
  return {
    guidebookId: "g1",
    workspaceId: "w1",
    propertyId: "p1",
    schemaVersion: GUIDEBOOK_DRAFT_SCHEMA,
    revision: 1,
    title: "Guest Guide",
    description: "Welcome",
    persistedAt: now,
    persistedBy: "actor",
    sections: [
      { id: "s1", name: "Welcome", visible: true, position: 0, blocks: [] },
    ],
  };
}
function context(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    commandId: crypto.randomUUID(),
    correlationId: "correlation",
    actorId: "actor",
    workspaceId: "w1",
    guidebookId: "g1",
    expectedRevision: 1,
    enteredAt: now,
    ...overrides,
  };
}
class Drafts implements GuidebookDraftRepository {
  value: GuidebookDraft | null = draft();
  saves = 0;
  async load() {
    return this.value;
  }
  async save(scope: CommandContext, value: GuidebookDraft) {
    if (!this.value || this.value.revision !== scope.expectedRevision)
      throw Object.assign(new Error("conflict"), { code: "DRAFT_CONFLICT" });
    this.saves++;
    this.value = value;
    return value;
  }
}
class Receipts implements GuidebookCommandReceiptRepository {
  values = new Map<string, Receipt>();
  async find(_workspace: string, id: string) {
    return this.values.get(id) ?? null;
  }
  async begin(value: Receipt) {
    if (this.values.has(value.commandId)) return "exists" as const;
    this.values.set(value.commandId, value);
    return "started" as const;
  }
  async complete(
    _workspace: string,
    id: string,
    outcome: AuthoringResult<unknown>,
  ) {
    const prior = this.values.get(id)!;
    this.values.set(id, {
      ...prior,
      state: outcome.ok ? "completed" : "failed",
      outcome,
    });
  }
}
function setup() {
  const drafts = new Drafts(),
    receipts = new Receipts(),
    counts = new Map<string, number>();
  return {
    drafts,
    receipts,
    deps: {
      drafts,
      receipts,
      now: () => new Date(now),
      id: () => {
        const operation =
            [...receipts.values.values()].at(-1)?.operation ?? "item",
          count = (counts.get(operation) ?? 0) + 1;
        counts.set(operation, count);
        return operation === "create-section"
          ? "new-section"
          : operation === "duplicate-section"
            ? "copy-section"
            : operation === "create-block"
              ? "block-1"
              : operation === "duplicate-block"
                ? "block-copy"
                : `${operation}-${count}`;
      },
      timeoutMs: 20,
    } satisfies AuthoringDependencies,
  };
}

describe("GB-001B authoring application", () => {
  it("does not impose component-only requirements on migrated mixed drafts", () => {
    const mixed: GuidebookDraft = {
      ...draft(),
      sections: [
        {
          id: "welcome",
          name: "Welcome",
          visible: true,
          position: 0,
          blocks: [
            { id: "legacy", type: "rich-text", schemaVersion: GUIDEBOOK_BLOCK_SCHEMA, position: 0, visible: true, content: { text: "Welcome" } },
            initialBlock("component", "gallery", 1, "gallery") as Extract<AuthoringBlock, { type: "component" }>,
          ],
        },
      ],
    };
    const readiness = evaluateReadiness(mixed);
    expect(readiness.issues.map((issue) => issue.code)).not.toContain("MISSING_WIFI_CARD");
    expect(readiness.issues.map((issue) => issue.code)).not.toContain("MISSING_EMERGENCY_CONTACT_CARD");
  });
  it("executes all six section commands with deterministic positions", async () => {
    const x = setup();
    let c = context({ commandId: "create" }),
      result = await createGuidebookSection(x.deps, c, {
        name: "Arrival",
        afterSectionId: "s1",
      });
    expect(result.ok && result.value.sections.map((s) => s.name)).toEqual([
      "Welcome",
      "Arrival",
    ]);
    c = context({ commandId: "rename", expectedRevision: 2 });
    await renameGuidebookSection(x.deps, c, {
      sectionId: "new-section",
      name: "Arrival details",
    });
    c = context({ commandId: "hide", expectedRevision: 3 });
    await setGuidebookSectionVisibility(x.deps, c, {
      sectionId: "new-section",
      visible: false,
    });
    c = context({ commandId: "duplicate", expectedRevision: 4 });
    await duplicateGuidebookSection(x.deps, c, { sectionId: "s1" });
    c = context({ commandId: "move", expectedRevision: 5 });
    await reorderGuidebookSections(x.deps, c, {
      sectionId: "copy-section",
      direction: "up",
    });
    c = context({ commandId: "delete", expectedRevision: 6 });
    result = await deleteGuidebookSection(x.deps, c, {
      sectionId: "new-section",
    });
    expect(
      result.ok && result.value.sections.map((s) => [s.name, s.position]),
    ).toEqual([
      ["Welcome (copy)", 0],
      ["Welcome", 1],
    ]);
  });
  it("restores a prior sections snapshot as a new revision (undo/redo)", async () => {
    const x = setup(),
      before = draft().sections;
    let c = context({ commandId: "add" }),
      result = await createGuidebookSection(x.deps, c, { name: "Arrival" });
    expect(result.ok && result.value.sections.map((s) => s.name)).toEqual([
      "Welcome",
      "Arrival",
    ]);
    c = context({ commandId: "undo", expectedRevision: 2 });
    result = await restoreGuidebookSections(x.deps, c, { sections: before });
    expect(result.ok && result.value.sections.map((s) => s.name)).toEqual([
      "Welcome",
    ]);
    expect(result.ok && result.value.revision).toBe(3);
  });
  it("updates brand identity without touching sections", async () => {
    const x = setup(),
      c = context({ commandId: "brand" });
    const result = await updateGuidebookBrand(x.deps, c, {
      brand: { logoUrl: "https://cdn.example/logo.png", primaryColor: "#111111", accentColor: "#c78a38" },
    });
    expect(result.ok && result.value.brand).toEqual({
      logoUrl: "https://cdn.example/logo.png",
      primaryColor: "#111111",
      accentColor: "#c78a38",
    });
    expect(result.ok && result.value.sections.map((s) => s.name)).toEqual([
      "Welcome",
    ]);
  });
  it("persists editable hero copy in the canonical draft revision", async () => {
    const x = setup(),
      c = context({ commandId: "hero" });
    const result = await updateGuidebookDetails(x.deps, c, {
      heroHeadline: "Settle in and stay awhile.",
      description: "Your local guide to an effortless Mesa stay.",
    });
    expect(result.ok && result.value.brand?.heroHeadline).toBe(
      "Settle in and stay awhile.",
    );
    expect(result.ok && result.value.description).toBe(
      "Your local guide to an effortless Mesa stay.",
    );
    expect(x.drafts.saves).toBe(1);
    expect([...x.receipts.values.values()][0]?.operation).toBe("draft-save");
  });
  it("moves one Gallery photo into a chosen section as an Image block", async () => {
    const x = setup();
    x.drafts.value = {
      ...draft(),
      sections: [
        {
          id: "s1", name: "Welcome", visible: true, position: 0,
          blocks: [{
            ...(initialBlock("component", "gallery", 0, "gallery") as Extract<AuthoringBlock, { type: "component" }>),
            content: {
              ...(initialBlock("component", "gallery", 0, "gallery") as Extract<AuthoringBlock, { type: "component" }>).content,
              mediaRefs: [
                { assetId: "gbm_photo_one", versionId: "v1", alt: "Pool", decorative: false },
                { assetId: "gbm_photo_two", versionId: "v1", alt: "Patio", decorative: false },
              ],
            },
          }],
        },
        { id: "s2", name: "Amenities", visible: true, position: 1, blocks: [] },
      ],
    };
    const result = await moveGuidebookMediaToSection(x.deps, context({ commandId: "move-photo" }), {
      sourceSectionId: "s1",
      sourceBlockId: "gallery",
      assetId: "gbm_photo_one",
      targetSectionId: "s2",
    });
    expect(result.ok && (result.value.sections[0].blocks[0] as Extract<AuthoringBlock, { type: "component" }>).content.mediaRefs.map((item) => item.assetId)).toEqual(["gbm_photo_two"]);
    expect(result.ok && (result.value.sections[1].blocks[0] as Extract<AuthoringBlock, { type: "component" }>).content).toMatchObject({ componentKey: "image", mediaRefs: [{ assetId: "gbm_photo_one", alt: "Pool" }] });
  });
  it("executes block create, update, visibility, reorder, duplicate, and delete", async () => {
    const x = setup();
    let c = context({ commandId: "add" }),
      result = await createGuidebookBlock(x.deps, c, {
        sectionId: "s1",
        type: "heading",
      });
    expect(result.ok && result.value.sections[0].blocks[0].type).toBe(
      "heading",
    );
    const heading: HeadingBlock = {
      ...(initialBlock("heading", "block-1", 0) as HeadingBlock),
      content: { text: "Welcome home", level: 2 },
    };
    c = context({ commandId: "edit", expectedRevision: 2 });
    await updateGuidebookBlock(x.deps, c, { sectionId: "s1", block: heading });
    c = context({ commandId: "hide", expectedRevision: 3 });
    await setGuidebookBlockVisibility(x.deps, c, {
      sectionId: "s1",
      blockId: "block-1",
      visible: false,
    });
    c = context({ commandId: "copy", expectedRevision: 4 });
    await duplicateGuidebookBlock(x.deps, c, {
      sectionId: "s1",
      blockId: "block-1",
    });
    c = context({ commandId: "move", expectedRevision: 5 });
    await reorderGuidebookBlocks(x.deps, c, {
      sectionId: "s1",
      blockId: "block-copy",
      direction: "up",
    });
    c = context({ commandId: "delete", expectedRevision: 6 });
    result = await deleteGuidebookBlock(x.deps, c, {
      sectionId: "s1",
      blockId: "block-1",
    });
    expect(result.ok && result.value.sections[0].blocks).toHaveLength(1);
  });
  it("validates every v1 discriminator and rejects unsupported content", () => {
    for (const type of [
      "heading",
      "rich-text",
      "image",
      "instruction",
      "contact",
      "location",
      "link",
      "callout",
      "checklist",
    ] as const)
      expect(validateBlock(initialBlock(type, `b-${type}`, 0)).type).toBe(type);
    const component=validateBlock(initialBlock("component","b-hero",0,"hero"));
    expect(component.type==="component"&&component.content).toMatchObject({componentKey:"hero",componentVersionId:"hero-v1",source:"inline"});
    expect(() =>
      validateBlock({
        id: "bad",
        type: "video",
        schemaVersion: GUIDEBOOK_BLOCK_SCHEMA,
        position: 0,
        visible: true,
        content: {},
      }),
    ).toThrow(/unsupported/);
    expect(() =>
      validateBlock({
        ...initialBlock("link", "link", 0),
        content: { label: "Bad", url: "javascript:alert(1)" },
      }),
    ).toThrow(/scheme/);
  });
  it("gives specific, actionable errors for a missing image or link destination on visible blocks at publish time", () => {
    const image = {
      ...initialBlock("image", "img", 0),
      content: { mediaRef: "", alt: "Pool" },
    };
    expect(() => validateBlock(image, "publish")).toThrow(/Add an image/);
    expect(() => validateBlock(image, "draft")).not.toThrow();
    const link = {
      ...initialBlock("link", "lnk", 0),
      content: { label: "Book now", url: "" },
    };
    expect(() => validateBlock(link, "publish")).toThrow(
      /Add a destination link/,
    );
    expect(() => validateBlock(link, "draft")).not.toThrow();
    const hiddenImage = { ...image, visible: false };
    expect(() => validateBlock(hiddenImage, "publish")).not.toThrow();
  });
  it("returns a conflict without overwriting or discarding the local command", async () => {
    const x = setup();
    x.drafts.value = { ...draft(), revision: 2 };
    const result = await renameGuidebookSection(
      x.deps,
      context({ commandId: "stale" }),
      { sectionId: "s1", name: "Local edit" },
    );
    expect(result).toMatchObject({
      ok: false,
      code: "DRAFT_CONFLICT",
      baseRevision: 1,
      serverRevision: 2,
    });
    expect(x.drafts.saves).toBe(0);
    expect(x.receipts.values.get("stale")?.outcome).toMatchObject({
      code: "DRAFT_CONFLICT",
    });
  });
  it("reuses a completed receipt and rejects different input for the same key", async () => {
    const x = setup(),
      c = context({ commandId: "same" });
    const first = await createGuidebookSection(x.deps, c, { name: "Arrival" }),
      again = await createGuidebookSection(x.deps, c, { name: "Arrival" }),
      different = await createGuidebookSection(x.deps, c, { name: "Parking" });
    expect(first.ok).toBe(true);
    expect(again).toEqual(first);
    expect(different).toMatchObject({
      ok: false,
      code: "COMMAND_RECEIPT_CONFLICT",
    });
    expect(x.drafts.saves).toBe(1);
  });
  it("classifies a never-settling repository as a timeout", async () => {
    const x = setup(),
      deps: AuthoringDependencies = {
        ...x.deps,
        drafts: {
          load: () => new Promise(() => {}),
          save: x.drafts.save.bind(x.drafts),
        },
        timeoutMs: 5,
      };
    await expect(
      createGuidebookSection(deps, context({ commandId: "timeout" }), {
        name: "Arrival",
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: "timeout",
      code: "DRAFT_PERSIST_TIMEOUT",
    });
  });
  it("builds deterministic snapshots without hidden sections or blocks", () => {
    const visible: HeadingBlock = {
        ...(initialBlock("heading", "h", 0) as HeadingBlock),
        content: { text: "Welcome", level: 2 },
      },
      hidden: AuthoringBlock = {
        ...initialBlock("rich-text", "r", 1),
        visible: false,
      },
      value: GuidebookDraft = {
        ...draft(),
        sections: [
          {
            id: "s1",
            name: "Welcome",
            position: 0,
            visible: true,
            blocks: [visible, hidden],
          },
          { id: "s2", name: "Hidden", position: 1, visible: false, blocks: [] },
        ],
      };
    const snapshot = buildSnapshot(value, { name: "Retreat" }, now);
    expect(snapshot.sections).toHaveLength(1);
    expect(snapshot.sections[0].blocks).toHaveLength(1);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
  it("publishes the canonical draft once and preserves the active version when publication fails", async () => {
    const x = setup(),
      heading: HeadingBlock = {
        ...(initialBlock("heading", "h", 0) as HeadingBlock),
        content: { text: "Welcome", level: 2 },
      };
    x.drafts.value = {
      ...draft(),
      sections: [{ ...draft().sections[0], blocks: [heading] }],
    };
    let active = "prior",
      calls = 0;
    const deps: AuthoringDependencies = {
      ...x.deps,
      properties: {
        async load() {
          return { name: "Retreat" };
        },
      },
      versions: {
        async publish(input) {
          calls++;
          expect(input.draft).toBe(x.drafts.value);
          active = "next";
          return { versionId: "next", version: 2 };
        },
      },
    };
    const command = context({ commandId: "publish" }),
      first = await publishGuidebookVersion(deps, command),
      again = await publishGuidebookVersion(deps, command);
    expect(first).toMatchObject({
      ok: true,
      value: { versionId: "next", version: 2 },
    });
    expect(again).toEqual(first);
    expect(calls).toBe(1);
    expect(active).toBe("next");
    const failed = await publishGuidebookVersion(
      {
        ...deps,
        versions: {
          async publish() {
            throw Object.assign(new Error("failed"), {
              code: "PUBLICATION_FAILED",
            });
          },
        },
      },
      context({ commandId: "failed" }),
    );
    expect(failed).toMatchObject({ ok: false, code: "PUBLICATION_FAILED" });
    expect(active).toBe("next");
  });
  it("runs authoritative readiness before publication", async () => {
    const x = setup(),
      called = { value: false };
    x.drafts.value = {
      ...draft(),
      sections: [{ ...draft().sections[0], visible: false }],
    };
    const result = await publishGuidebookVersion(
      {
        ...x.deps,
        properties: {
          async load() {
            return { name: "Retreat" };
          },
        },
        versions: {
          async publish() {
            called.value = true;
            return { versionId: "bad", version: 1 };
          },
        },
      },
      context({ commandId: "not-ready" }),
    );
    expect(result).toMatchObject({ ok: false, code: "PUBLICATION_NOT_READY" });
    expect(called.value).toBe(false);
  });
  it("distinguishes unavailable analytics from confirmed zero and classifies timeouts", async () => {
    const x = setup(),
      scope = { workspaceId: "w1", guidebookId: "g1", actorId: "actor" };
    await expect(
      loadGuidebookEngagementSummary(
        {
          ...x.deps,
          analytics: {
            async summary() {
              return null;
            },
          },
        },
        scope,
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: { available: false, events: [] },
    });
    await expect(
      loadGuidebookEngagementSummary(
        {
          ...x.deps,
          analytics: {
            async summary() {
              return { events: [], uniqueVisitors: 0, viewsByDay: [] };
            },
          },
        },
        scope,
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: { available: true, events: [] },
    });
    await expect(
      loadGuidebookEngagementSummary(
        {
          ...x.deps,
          analytics: { summary: () => new Promise(() => {}) },
          timeoutMs: 5,
        },
        scope,
      ),
    ).resolves.toMatchObject({
      ok: false,
      code: "ANALYTICS_UNAVAILABLE",
      status: "timeout",
    });
  });
  it("emits only bounded sanitized command observations", async () => {
    const x = setup(),
      events: unknown[] = [];
    await createGuidebookSection(
      {
        ...x.deps,
        observer: {
          record: (event) => {
            events.push(event);
          },
        },
      },
      context({ commandId: "observed" }),
      { name: "Never log this content or https://secret.example" },
    );
    expect(events).toHaveLength(2);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("Never log");
    expect(serialized).not.toContain("secret.example");
    expect(serialized).not.toContain("snapshot");
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ outcome: "entered" }),
        expect.objectContaining({ outcome: "completed" }),
      ]),
    );
  });
  it("bounds receipt lookup and returns a classified command timeout", async () => {
    const x = setup(),
      receipts: GuidebookCommandReceiptRepository = {
        find: () => new Promise(() => {}),
        begin: x.receipts.begin.bind(x.receipts),
        complete: x.receipts.complete.bind(x.receipts),
      };
    await expect(
      createGuidebookSection(
        { ...x.deps, receipts, timeoutMs: 5 },
        context({ commandId: "receipt-timeout" }),
        { name: "Arrival" },
      ),
    ).resolves.toMatchObject({
      ok: false,
      code: "COMMAND_TIMEOUT",
      status: "timeout",
    });
  });
  it("cleans only newly promoted media when atomic publication fails", async () => {
    const x = setup(),
      mediaRef = `gbm_${"a".repeat(26)}`,
      image = {
        ...initialBlock("image", "image", 0),
        content: { mediaRef, alt: "Pool" },
      } as AuthoringBlock;
    x.drafts.value = {
      ...draft(),
      sections: [{ ...draft().sections[0], blocks: [image] }],
    };
    const cleanup: string[][] = [];
    const result = await publishGuidebookVersion(
      {
        ...x.deps,
        properties: {
          async load() {
            return { name: "Retreat" };
          },
        },
        media: {
          async promote() {
            return {
              manifest: {
                [mediaRef]: {
                  url: "https://cdn.example/media",
                  mimeType: "image/webp",
                },
              },
              newlyPromoted: [mediaRef],
            };
          },
          async cleanupPromotion(input) {
            cleanup.push([...input.mediaIds]);
          },
        },
        versions: {
          async publish() {
            throw Object.assign(new Error("atomic failure"), {
              code: "PUBLICATION_FAILED",
            });
          },
        },
      },
      context({ commandId: "media-failure" }),
    );
    expect(result).toMatchObject({ ok: false, code: "PUBLICATION_FAILED" });
    expect(cleanup).toEqual([[mediaRef]]);
  });
});

describe("low-resolution image readiness", () => {
  const lowResRef = `gbm_${"a".repeat(26)}`,
    highResRef = `gbm_${"b".repeat(26)}`,
    unknownRef = `gbm_${"c".repeat(26)}`,
    mediaDimensions = buildMediaDimensionMap([
      { id: lowResRef, width: 1600, height: 400 },
      { id: highResRef, width: 1600, height: 1200 },
    ]);
  it("flags an image block whose shorter side is under the threshold", () => {
    const image = {
        ...initialBlock("image", "image", 0),
        content: { mediaRef: lowResRef, alt: "Pool" },
      } as AuthoringBlock,
      result = evaluateReadiness(
        {
          ...draft(),
          sections: [{ ...draft().sections[0], blocks: [image] }],
        },
        mediaDimensions,
      );
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "IMAGE_LOW_RESOLUTION",
        severity: "warning",
        blockId: "image",
      }),
    );
  });
  it("does not flag an image at or above the threshold, or one with unknown dimensions", () => {
    const highRes = {
        ...initialBlock("image", "high", 0),
        content: { mediaRef: highResRef, alt: "Pool" },
      } as AuthoringBlock,
      unknown = {
        ...initialBlock("image", "unknown", 1),
        content: { mediaRef: unknownRef, alt: "Pool" },
      } as AuthoringBlock,
      result = evaluateReadiness(
        {
          ...draft(),
          sections: [
            { ...draft().sections[0], blocks: [highRes, unknown] },
          ],
        },
        mediaDimensions,
      );
    expect(result.issues).not.toContainEqual(
      expect.objectContaining({ code: "IMAGE_LOW_RESOLUTION" }),
    );
  });
  it("flags a low-resolution image used in a component's media refs", () => {
    const hero = {
      ...initialBlock("component", "hero-block", 0, "hero"),
      content: {
        ...(initialBlock("component", "hero-block", 0, "hero") as Extract<
          AuthoringBlock,
          { type: "component" }
        >).content,
        mediaRefs: [
          {
            assetId: lowResRef,
            versionId: "v1",
            alt: "Villa exterior",
            decorative: false,
          },
        ],
      },
    } as AuthoringBlock;
    const result = evaluateReadiness(
      {
        ...draft(),
        sections: [{ ...draft().sections[0], blocks: [hero] }],
      },
      mediaDimensions,
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "IMAGE_LOW_RESOLUTION",
        severity: "warning",
        blockId: "hero-block",
      }),
    );
  });
});
