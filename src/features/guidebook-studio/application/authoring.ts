import {
  buildSnapshot,
  evaluateReadiness,
  initialBlock,
  normalizeSections,
  validateBlock,
  validateDraft,
  type AuthoringBlock,
  type AuthoringSection,
  type AuthoringBlockType,
  type GuidebookBrandIdentity,
  type GuidebookDraft,
  type ReadinessResult,
} from "../domain/authoring";

export type AuthoringErrorCode =
  | "GUIDEBOOK_NOT_FOUND"
  | "GUIDEBOOK_UNAUTHORIZED"
  | "GUIDEBOOK_ARCHIVED"
  | "DRAFT_NOT_FOUND"
  | "DRAFT_VERSION_UNSUPPORTED"
  | "DRAFT_CONFLICT"
  | "DRAFT_PERSIST_TIMEOUT"
  | "DRAFT_PERSIST_FAILED"
  | "SECTION_NOT_FOUND"
  | "SECTION_INVALID"
  | "SECTION_COMMAND_CONFLICT"
  | "BLOCK_NOT_FOUND"
  | "BLOCK_TYPE_UNSUPPORTED"
  | "BLOCK_CONTENT_INVALID"
  | "IMAGE_MEDIA_MISSING"
  | "LINK_DESTINATION_MISSING"
  | "BLOCK_COMMAND_CONFLICT"
  | "COMMAND_ALREADY_IN_PROGRESS"
  | "COMMAND_RECEIPT_CONFLICT"
  | "COMMAND_TIMEOUT"
  | "PUBLICATION_NOT_READY"
  | "PUBLICATION_CONFLICT"
  | "PUBLICATION_TIMEOUT"
  | "PUBLICATION_FAILED"
  | "ANALYTICS_UNAVAILABLE"
  | "WORKSPACE_STATE_UNAVAILABLE"
  | "MEDIA_REFERENCE_INVALID"
  | "MEDIA_TYPE_UNSUPPORTED"
  | "MEDIA_UPLOAD_FAILED"
  | "PUBLIC_SLUG_INVALID"
  | "PUBLIC_SLUG_CONFLICT";
export type AuthoringResult<T> =
  | Readonly<{
      ok: true;
      status: "completed" | "previously-completed";
      value: T;
      revision?: number;
      baseRevision?: never;
      serverRevision?: never;
    }>
  | Readonly<{
      ok: false;
      status:
        | "validation-failure"
        | "unauthorized"
        | "not-found"
        | "conflict"
        | "in-progress"
        | "unsupported"
        | "timeout"
        | "persistence-failure"
        | "unexpected";
      code: AuthoringErrorCode;
      message: string;
      baseRevision?: number;
      serverRevision?: number;
    }>;
type AuthoringFailure = Extract<AuthoringResult<never>, { ok: false }>;
export type CommandContext = Readonly<{
  commandId: string;
  correlationId: string;
  actorId: string;
  workspaceId: string;
  guidebookId: string;
  expectedRevision: number;
  enteredAt: string;
}>;
export type Receipt = Readonly<{
  workspaceId: string;
  guidebookId: string;
  commandId: string;
  actorId?: string;
  operation: string;
  fingerprint: string;
  state: "in-progress" | "completed" | "failed";
  outcome?: AuthoringResult<unknown>;
  createdAt: string;
}>;
export interface GuidebookDraftRepository {
  load(
    scope: Pick<CommandContext, "workspaceId" | "guidebookId" | "actorId">,
  ): Promise<GuidebookDraft | null>;
  save(scope: CommandContext, draft: GuidebookDraft): Promise<GuidebookDraft>;
}
export interface GuidebookCommandReceiptRepository {
  find(workspaceId: string, commandId: string): Promise<Receipt | null>;
  begin(receipt: Receipt): Promise<"started" | "exists">;
  complete(
    workspaceId: string,
    commandId: string,
    outcome: AuthoringResult<unknown>,
  ): Promise<void>;
}
export interface PublishedGuidebookVersionRepository {
  publish(
    input: Readonly<{
      context: CommandContext;
      draft: GuidebookDraft;
      snapshot: Readonly<Record<string, unknown>>;
    }>,
  ): Promise<Readonly<{ versionId: string; version: number }>>;
}
export interface GuidebookPropertyProjectionRepository {
  load(
    scope: Readonly<{
      workspaceId: string;
      propertyId: string;
      actorId: string;
    }>,
  ): Promise<Readonly<Record<string, unknown>> | null>;
}
export interface GuidebookAnalyticsRepository {
  summary(
    scope: Pick<CommandContext, "workspaceId" | "guidebookId" | "actorId">,
  ): Promise<
    | Readonly<{
        events: readonly Readonly<{
          eventType: string;
          sectionId?: string;
          count: number;
        }>[];
        uniqueVisitors: number;
        viewsByDay: readonly Readonly<{ date: string; count: number }>[];
      }>
    | null
  >;
}
export interface GuidebookAuthoringObserver {
  record(
    event: Readonly<{
      name: string;
      correlationId: string;
      guidebookId: string;
      commandType: string;
      outcome: string;
      durationMs: number;
      expectedRevision?: number;
      resultingRevision?: number;
      blockType?: AuthoringBlockType;
      failureClass?: string;
      draftSchemaVersion?: string;
    }>,
  ): Promise<void> | void;
}
export interface GuidebookLifecycleRepository {
  load(
    scope: Pick<CommandContext, "workspaceId" | "guidebookId" | "actorId">,
  ): Promise<Readonly<{
    propertyId: string;
    status: "draft" | "published" | "archived";
    revision: number;
  }> | null>;
  archive(context: CommandContext): Promise<
    Readonly<{
      guidebookId: string;
      revision: number;
      status: "draft" | "archived";
    }>
  >;
  restore(context: CommandContext): Promise<
    Readonly<{
      guidebookId: string;
      revision: number;
      status: "draft" | "archived";
    }>
  >;
  restoreVersion(
    context: CommandContext,
    versionId: string,
  ): Promise<
    Readonly<{
      guidebookId: string;
      revision: number;
      status: "draft" | "archived";
    }>
  >;
}
export interface GuidebookCreationRepository {
  create(
    input: Readonly<{
      context: CommandContext;
      propertyId: string;
      title: string;
      fingerprint: string;
    }>,
  ): Promise<
    Readonly<{ guidebookId: string; revision: number; status: "draft" }>
  >;
}
export type AuthoringDependencies = Readonly<{
  drafts: GuidebookDraftRepository;
  receipts: GuidebookCommandReceiptRepository;
  versions?: PublishedGuidebookVersionRepository;
  properties?: GuidebookPropertyProjectionRepository;
  analytics?: GuidebookAnalyticsRepository;
  observer?: GuidebookAuthoringObserver;
  lifecycle?: GuidebookLifecycleRepository;
  creation?: GuidebookCreationRepository;
  media?: Readonly<{
    promote(
      input: Readonly<{ context: CommandContext; mediaIds: readonly string[] }>,
    ): Promise<
      Readonly<{
        manifest: Readonly<
          Record<string, Readonly<{ url: string; mimeType: string }>>
        >;
        newlyPromoted: readonly string[];
      }>
    >;
    cleanupPromotion(
      input: Readonly<{ context: CommandContext; mediaIds: readonly string[] }>,
    ): Promise<unknown>;
  }>;
  timeoutMs?: number;
  now?: () => Date;
  id?: () => string;
}>;
type Mutation = (draft: GuidebookDraft, id: () => string) => GuidebookDraft;

export const loadGuidebookDraft = (
  deps: AuthoringDependencies,
  scope: Pick<CommandContext, "workspaceId" | "guidebookId" | "actorId">,
) =>
  bounded(
    () => deps.drafts.load(scope),
    deps.timeoutMs ?? 5000,
    "DRAFT_PERSIST_TIMEOUT",
  );
export const loadGuidebookWorkspace = loadGuidebookDraft;
export const persistGuidebookDraft = (
  deps: AuthoringDependencies,
  context: CommandContext,
  draft: GuidebookDraft,
) =>
  executeMutation(
    deps,
    context,
    "draft-save",
    fingerprint({ draft }),
    () => draft,
  );
export const createGuidebookSection = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ name: string; afterSectionId?: string }>,
) =>
  executeMutation(
    deps,
    context,
    "create-section",
    fingerprint(input),
    (draft, id) => {
      const name = sectionName(input.name);
      let position = draft.sections.length;
      if (input.afterSectionId) {
        const found = draft.sections.find(
          (section) => section.id === input.afterSectionId,
        );
        if (!found)
          throw failure("SECTION_NOT_FOUND", "The section was not found.");
        position = found.position + 1;
      }
      return next(draft, [
        ...draft.sections.slice(0, position),
        { id: id(), name, visible: true, position, blocks: [] },
        ...draft.sections.slice(position),
      ]);
    },
  );
export const renameGuidebookSection = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ sectionId: string; name: string }>,
) =>
  executeMutation(
    deps,
    context,
    "rename-section",
    fingerprint(input),
    (draft) =>
      next(
        draft,
        draft.sections.map((section) =>
          section.id === input.sectionId
            ? { ...section, name: sectionName(input.name) }
            : section,
        ),
        requireSection(draft, input.sectionId),
      ),
  );
export const reorderGuidebookSections = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ sectionId: string; direction: "up" | "down" }>,
) =>
  executeMutation(
    deps,
    context,
    "reorder-sections",
    fingerprint(input),
    (draft) => {
      const section = requireSection(draft, input.sectionId),
        target = section.position + (input.direction === "up" ? -1 : 1);
      if (target < 0 || target >= draft.sections.length) return draft;
      const sections = [...draft.sections],
        other = sections[target]!;
      sections[target] = section;
      sections[section.position] = other;
      return next(
        draft,
        sections.map((item, position) => ({ ...item, position })),
      );
    },
  );
export const setGuidebookSectionVisibility = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ sectionId: string; visible: boolean }>,
) =>
  executeMutation(
    deps,
    context,
    "section-visibility",
    fingerprint(input),
    (draft) =>
      next(
        draft,
        draft.sections.map((section) =>
          section.id === input.sectionId
            ? { ...section, visible: input.visible }
            : section,
        ),
        requireSection(draft, input.sectionId),
      ),
  );
export const restoreGuidebookSections = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ sections: readonly AuthoringSection[] }>,
) =>
  executeMutation(
    deps,
    context,
    "restore-sections",
    fingerprint(input),
    (draft) => next(draft, input.sections),
  );
export const updateGuidebookBrand = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ brand: GuidebookBrandIdentity }>,
) =>
  executeMutation(
    deps,
    context,
    "update-brand",
    fingerprint(input),
    (draft) => ({ ...draft, brand: input.brand }),
  );
export const duplicateGuidebookSection = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ sectionId: string }>,
) =>
  executeMutation(
    deps,
    context,
    "duplicate-section",
    fingerprint(input),
    (draft, id) => {
      const source = requireSection(draft, input.sectionId),
        copy = {
          ...source,
          id: id(),
          name: `${source.name} (copy)`,
          blocks: source.blocks.map((block) => ({ ...block, id: id() })),
        };
      return next(draft, [
        ...draft.sections.slice(0, source.position + 1),
        copy,
        ...draft.sections.slice(source.position + 1),
      ]);
    },
  );
export const deleteGuidebookSection = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ sectionId: string }>,
) =>
  executeMutation(
    deps,
    context,
    "delete-section",
    fingerprint(input),
    (draft) => {
      requireSection(draft, input.sectionId);
      return next(
        draft,
        draft.sections.filter((section) => section.id !== input.sectionId),
      );
    },
  );
export const createGuidebookBlock = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ sectionId: string; type: AuthoringBlockType; componentKey?: string }>,
) =>
  executeMutation(
    deps,
    context,
    "create-block",
    fingerprint(input),
    (draft, id) =>
      updateSection(draft, input.sectionId, (section) => ({
        ...section,
        blocks: [
          ...section.blocks,
          initialBlock(input.type, id(), section.blocks.length, input.componentKey),
        ],
      })),
  );
export const updateGuidebookBlock = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ sectionId: string; block: AuthoringBlock }>,
) =>
  executeMutation(deps, context, "update-block", fingerprint(input), (draft) =>
    updateSection(draft, input.sectionId, (section) => {
      requireBlock(section, input.block.id);
      const block = validateBlock(input.block, "draft");
      return {
        ...section,
        blocks: section.blocks.map((item) =>
          item.id === block.id ? block : item,
        ),
      };
    }),
  );
export const reorderGuidebookBlocks = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{
    sectionId: string;
    blockId: string;
    direction: "up" | "down";
  }>,
) =>
  executeMutation(
    deps,
    context,
    "reorder-blocks",
    fingerprint(input),
    (draft) =>
      updateSection(draft, input.sectionId, (section) => {
        const block = requireBlock(section, input.blockId),
          target = block.position + (input.direction === "up" ? -1 : 1);
        if (target < 0 || target >= section.blocks.length) return section;
        const blocks = [...section.blocks],
          other = blocks[target]!;
        blocks[target] = block;
        blocks[block.position] = other;
        return {
          ...section,
          blocks: blocks.map((item, position) => ({ ...item, position })),
        };
      }),
  );
export const setGuidebookBlockVisibility = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ sectionId: string; blockId: string; visible: boolean }>,
) =>
  executeMutation(
    deps,
    context,
    "block-visibility",
    fingerprint(input),
    (draft) =>
      updateSection(draft, input.sectionId, (section) => {
        requireBlock(section, input.blockId);
        return {
          ...section,
          blocks: section.blocks.map((block) =>
            block.id === input.blockId
              ? { ...block, visible: input.visible }
              : block,
          ),
        };
      }),
  );
export const duplicateGuidebookBlock = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ sectionId: string; blockId: string }>,
) =>
  executeMutation(
    deps,
    context,
    "duplicate-block",
    fingerprint(input),
    (draft, id) =>
      updateSection(draft, input.sectionId, (section) => {
        const source = requireBlock(section, input.blockId),
          copy = { ...source, id: id() };
        return {
          ...section,
          blocks: [
            ...section.blocks.slice(0, source.position + 1),
            copy,
            ...section.blocks.slice(source.position + 1),
          ],
        };
      }),
  );
export const deleteGuidebookBlock = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ sectionId: string; blockId: string }>,
) =>
  executeMutation(deps, context, "delete-block", fingerprint(input), (draft) =>
    updateSection(draft, input.sectionId, (section) => {
      requireBlock(section, input.blockId);
      return {
        ...section,
        blocks: section.blocks.filter((block) => block.id !== input.blockId),
      };
    }),
  );
export const buildGuidebookDraftPreview = (draft: GuidebookDraft) =>
  validateDraft(draft, "draft");
export const evaluateGuidebookPublicationReadiness = (
  draft: GuidebookDraft,
): ReadinessResult => evaluateReadiness(validateDraft(draft, "draft"));
export const buildPublishedGuidebookSnapshot = (
  draft: GuidebookDraft,
  property: Readonly<Record<string, unknown>>,
  publishedAt: string,
) => buildSnapshot(draft, property, publishedAt);
export async function publishGuidebookVersion(
  deps: AuthoringDependencies,
  context: CommandContext,
) {
  if (!deps.versions || !deps.properties)
    return fail(
      "PUBLICATION_FAILED",
      "persistence-failure",
      "Publication is unavailable.",
    );
  return execute(
    deps,
    context,
    "publish",
    fingerprint({
      guidebookId: context.guidebookId,
      expectedRevision: context.expectedRevision,
    }),
    async (draft) => {
      const property = await bounded(
        () =>
          deps.properties!.load({
            workspaceId: context.workspaceId,
            propertyId: draft.propertyId,
            actorId: context.actorId,
          }),
        deps.timeoutMs ?? 5000,
        "PUBLICATION_TIMEOUT",
      );
      if (!property)
        throw failure(
          "GUIDEBOOK_UNAUTHORIZED",
          "Property access is not permitted.",
        );
      let snapshot = buildPublishedGuidebookSnapshot(
        draft,
        property,
        (deps.now?.() ?? new Date()).toISOString(),
      );
      const mediaIds = [
        ...new Set(
          draft.sections
            .filter((section) => section.visible)
            .flatMap((section) =>
              section.blocks
                .filter((block) => block.visible && block.type === "image")
                .map(
                  (block) => (block.content as { mediaRef: string }).mediaRef,
                ),
            )
            .filter(Boolean),
        ),
      ].sort();
      if (mediaIds.length) {
        if (!deps.media)
          throw failure(
            "MEDIA_REFERENCE_INVALID",
            "Publication media is unavailable.",
          );
        const promotion = await bounded(
          () => deps.media!.promote({ context, mediaIds }),
          deps.timeoutMs ?? 5000,
          "PUBLICATION_TIMEOUT",
        );
        const manifest = promotion.manifest;
        if (mediaIds.some((id) => !manifest[id]))
          throw failure(
            "MEDIA_REFERENCE_INVALID",
            "Publication media could not be resolved.",
          );
        snapshot = Object.freeze({
          ...snapshot,
          media: Object.freeze({ ...manifest }),
        });
        try {
          return await deps.versions!.publish({ context, draft, snapshot });
        } catch (error) {
          await bounded(
            () =>
              deps.media!.cleanupPromotion({
                context,
                mediaIds: promotion.newlyPromoted,
              }),
            deps.timeoutMs ?? 5000,
            "PUBLICATION_TIMEOUT",
          ).catch(() => undefined);
          throw error;
        }
      }
      return deps.versions!.publish({ context, draft, snapshot });
    },
    "PUBLICATION_TIMEOUT",
  );
}
export async function loadGuidebookEngagementSummary(
  deps: AuthoringDependencies,
  scope: Pick<CommandContext, "workspaceId" | "guidebookId" | "actorId"> &
    Readonly<{ correlationId?: string }>,
): Promise<
  AuthoringResult<
    Readonly<{
      available: boolean;
      events: readonly Readonly<{
        eventType: string;
        sectionId?: string;
        count: number;
      }>[];
      uniqueVisitors: number;
      viewsByDay: readonly Readonly<{ date: string; count: number }>[];
    }>
  >
> {
  const startedAt = Date.now(),
    context: CommandContext = {
      ...scope,
      commandId: "analytics-load",
      correlationId: scope.correlationId ?? "analytics",
      expectedRevision: 0,
      enteredAt: new Date().toISOString(),
    };
  observe(deps, context, "analytics-load", "entered", startedAt);
  if (!deps.analytics)
    return observedAnalytics(
      deps,
      context,
      startedAt,
      fail(
        "ANALYTICS_UNAVAILABLE",
        "persistence-failure",
        "Analytics are unavailable.",
      ),
    );
  try {
    const rows = await bounded(
      () => deps.analytics!.summary(scope),
      deps.timeoutMs ?? 5000,
      "COMMAND_TIMEOUT",
    );
    return observedAnalytics(deps, context, startedAt, {
      ok: true,
      status: "completed",
      value:
        rows === null
          ? { available: false, events: [], uniqueVisitors: 0, viewsByDay: [] }
          : {
              available: true,
              events: rows.events,
              uniqueVisitors: rows.uniqueVisitors,
              viewsByDay: rows.viewsByDay,
            },
    });
  } catch (error) {
    const timedOut =
      typeof error === "object" &&
      error &&
      "code" in error &&
      String(error.code) === "COMMAND_TIMEOUT";
    return observedAnalytics(
      deps,
      context,
      startedAt,
      fail(
        "ANALYTICS_UNAVAILABLE",
        timedOut ? "timeout" : "persistence-failure",
        timedOut
          ? "Analytics did not become available in time."
          : "Analytics are unavailable.",
      ),
    );
  }
}
function observedAnalytics<T>(
  deps: AuthoringDependencies,
  context: CommandContext,
  startedAt: number,
  result: AuthoringResult<T>,
) {
  observe(
    deps,
    context,
    "analytics-load",
    result.ok
      ? "completed"
      : result.status === "timeout"
        ? "timed-out"
        : "unavailable",
    startedAt,
    result,
  );
  return result;
}

export const archiveGuidebook = (
  deps: AuthoringDependencies,
  context: CommandContext,
) =>
  executeLifecycle(deps, context, "archive", {}, (repository) =>
    repository.archive(context),
  );
export const restoreGuidebook = (
  deps: AuthoringDependencies,
  context: CommandContext,
) =>
  executeLifecycle(deps, context, "restore", {}, (repository) =>
    repository.restore(context),
  );
export const restoreHistoricalGuidebookContent = (
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ versionId: string }>,
) =>
  executeLifecycle(deps, context, "restore-version", input, (repository) =>
    repository.restoreVersion(context, input.versionId),
  );
export async function createGuidebookWithReceipt(
  deps: AuthoringDependencies,
  context: CommandContext,
  input: Readonly<{ propertyId: string; title: string }>,
): Promise<
  AuthoringResult<
    Readonly<{ guidebookId: string; revision: number; status: "draft" }>
  >
> {
  if (!deps.creation)
    return fail(
      "DRAFT_PERSIST_FAILED",
      "persistence-failure",
      "Guidebook creation is unavailable.",
    );
  try {
    return {
      ok: true,
      status: "completed",
      value: await bounded(
        () =>
          deps.creation!.create({
            context,
            propertyId: input.propertyId,
            title: input.title.trim() || "Guest Guide",
            fingerprint: fingerprint(input),
          }),
        deps.timeoutMs ?? 5000,
        "COMMAND_TIMEOUT",
      ),
    };
  } catch (error) {
    return classified(error, "COMMAND_TIMEOUT");
  }
}

async function executeLifecycle<T>(
  deps: AuthoringDependencies,
  context: CommandContext,
  operation: "archive" | "restore" | "restore-version",
  input: Readonly<Record<string, unknown>>,
  work: (repository: GuidebookLifecycleRepository) => Promise<T>,
): Promise<AuthoringResult<T>> {
  if (!deps.lifecycle)
    return fail(
      "DRAFT_PERSIST_FAILED",
      "persistence-failure",
      "Guidebook lifecycle management is unavailable.",
    );
  return executeScopedCommand(
    deps,
    context,
    operation,
    fingerprint(input),
    async () => work(deps.lifecycle!),
    "COMMAND_TIMEOUT",
  );
}

async function executeMutation(
  deps: AuthoringDependencies,
  context: CommandContext,
  operation: string,
  hash: string,
  mutation: Mutation,
) {
  return execute(
    deps,
    context,
    operation,
    hash,
    async (draft) =>
      deps.drafts.save(
        context,
        validateDraft({
          ...mutation(draft, deps.id ?? crypto.randomUUID),
          revision: draft.revision + 1,
          persistedAt: (deps.now?.() ?? new Date()).toISOString(),
          persistedBy: context.actorId,
        }),
      ),
    "DRAFT_PERSIST_TIMEOUT",
  );
}
async function executeScopedCommand<T>(
  deps: AuthoringDependencies,
  context: CommandContext,
  operation: string,
  hash: string,
  work: () => Promise<T>,
  timeoutCode: AuthoringErrorCode,
): Promise<AuthoringResult<T>> {
  const startedAt = Date.now(),
    finish = (outcome: AuthoringResult<T>) => {
      observe(
        deps,
        context,
        operation,
        outcome.ok ? outcome.status : outcome.status,
        startedAt,
        outcome,
      );
      return outcome;
    };
  observe(deps, context, operation, "entered", startedAt);
  let prior: Receipt | null;
  try {
    prior = await bounded(
      () => deps.receipts.find(context.workspaceId, context.commandId),
      deps.timeoutMs ?? 5000,
      "COMMAND_TIMEOUT",
    );
  } catch (error) {
    return finish(classified(error, "COMMAND_TIMEOUT"));
  }
  if (prior) {
    if (
      prior.guidebookId !== context.guidebookId ||
      prior.operation !== operation ||
      prior.fingerprint !== hash
    )
      return finish(
        fail(
          "COMMAND_RECEIPT_CONFLICT",
          "conflict",
          "The command identifier was already used for different work.",
        ),
      );
    if (prior.state === "in-progress")
      return finish(
        fail(
          "COMMAND_ALREADY_IN_PROGRESS",
          "in-progress",
          "This command is already in progress.",
        ),
      );
    return finish(prior.outcome as AuthoringResult<T>);
  }
  const receipt: Receipt = {
    workspaceId: context.workspaceId,
    guidebookId: context.guidebookId,
    commandId: context.commandId,
    actorId: context.actorId,
    operation,
    fingerprint: hash,
    state: "in-progress",
    createdAt: context.enteredAt,
  };
  try {
    if (
      (await bounded(
        () => deps.receipts.begin(receipt),
        deps.timeoutMs ?? 5000,
        "COMMAND_TIMEOUT",
      )) === "exists"
    )
      return finish(
        fail(
          "COMMAND_ALREADY_IN_PROGRESS",
          "in-progress",
          "This command is already in progress.",
        ),
      );
  } catch (error) {
    return finish(classified(error, "COMMAND_TIMEOUT"));
  }
  let outcome: AuthoringResult<T>;
  try {
    outcome = {
      ok: true,
      status: "completed",
      value: await bounded(work, deps.timeoutMs ?? 5000, timeoutCode),
    };
  } catch (error) {
    outcome = classified(error, timeoutCode);
  }
  try {
    await bounded(
      () =>
        deps.receipts.complete(
          context.workspaceId,
          context.commandId,
          outcome as AuthoringResult<unknown>,
        ),
      deps.timeoutMs ?? 5000,
      "COMMAND_TIMEOUT",
    );
  } catch {}
  return finish(outcome);
}
async function execute<T>(
  deps: AuthoringDependencies,
  context: CommandContext,
  operation: string,
  hash: string,
  work: (draft: GuidebookDraft) => Promise<T>,
  timeoutCode: AuthoringErrorCode,
): Promise<AuthoringResult<T>> {
  const startedAt = Date.now();
  observe(deps, context, operation, "entered", startedAt);
  const finish = (outcome: AuthoringResult<T>) => {
    observe(
      deps,
      context,
      operation,
      outcome.ok ? outcome.status : outcome.status,
      startedAt,
      outcome,
    );
    return outcome;
  };
  let prior: Receipt | null;
  try {
    prior = await bounded(
      () => deps.receipts.find(context.workspaceId, context.commandId),
      deps.timeoutMs ?? 5000,
      "COMMAND_TIMEOUT",
    );
  } catch (error) {
    return finish(classified(error, "COMMAND_TIMEOUT"));
  }
  if (prior) {
    if (
      prior.guidebookId !== context.guidebookId ||
      prior.operation !== operation ||
      prior.fingerprint !== hash
    )
      return finish(
        fail(
          "COMMAND_RECEIPT_CONFLICT",
          "conflict",
          "The command identifier was already used for different work.",
        ),
      );
    if (prior.state === "in-progress")
      return finish(
        fail(
          "COMMAND_ALREADY_IN_PROGRESS",
          "in-progress",
          "This command is already in progress.",
        ),
      );
    return finish(prior.outcome as AuthoringResult<T>);
  }
  const receipt: Receipt = {
    workspaceId: context.workspaceId,
    guidebookId: context.guidebookId,
    commandId: context.commandId,
    operation,
    fingerprint: hash,
    state: "in-progress",
    createdAt: context.enteredAt,
  };
  try {
    if (
      (await bounded(
        () => deps.receipts.begin(receipt),
        deps.timeoutMs ?? 5000,
        "COMMAND_TIMEOUT",
      )) === "exists"
    )
      return finish(
        fail(
          "COMMAND_ALREADY_IN_PROGRESS",
          "in-progress",
          "This command is already in progress.",
        ),
      );
  } catch (error) {
    return finish(classified(error, "COMMAND_TIMEOUT"));
  }
  let outcome: AuthoringResult<T>;
  try {
    const draft = await bounded(
      () => deps.drafts.load(context),
      deps.timeoutMs ?? 5000,
      timeoutCode,
    );
    if (!draft)
      outcome = fail(
        "DRAFT_NOT_FOUND",
        "not-found",
        "The guidebook draft was not found.",
      );
    else if (draft.workspaceId !== context.workspaceId)
      outcome = fail(
        "GUIDEBOOK_UNAUTHORIZED",
        "unauthorized",
        "Guidebook access is not permitted.",
      );
    else if (draft.revision !== context.expectedRevision)
      outcome = {
        ...fail(
          "DRAFT_CONFLICT",
          "conflict",
          "A newer draft exists. Your local edits are still available.",
        ),
        baseRevision: context.expectedRevision,
        serverRevision: draft.revision,
      };
    else {
      const value = await bounded(
        () => work(draft),
        deps.timeoutMs ?? 5000,
        timeoutCode,
      );
      outcome = {
        ok: true,
        status: "completed",
        value,
        ...(isDraft(value) ? { revision: value.revision } : {}),
      };
    }
  } catch (error) {
    outcome = classified(error, timeoutCode);
  }
  try {
    await bounded(
      () =>
        deps.receipts.complete(
          context.workspaceId,
          context.commandId,
          outcome as AuthoringResult<unknown>,
        ),
      deps.timeoutMs ?? 5000,
      "COMMAND_TIMEOUT",
    );
  } catch {}
  return finish(outcome);
}

function observe<T>(
  deps: AuthoringDependencies,
  context: CommandContext,
  operation: string,
  outcome: string,
  startedAt: number,
  result?: AuthoringResult<T>,
) {
  if (!deps.observer) return;
  try {
    void Promise.resolve(
      deps.observer.record({
        name: `guidebook.${operation}`,
        correlationId: context.correlationId,
        guidebookId: context.guidebookId,
        commandType: operation,
        outcome,
        durationMs: Math.max(0, Date.now() - startedAt),
        expectedRevision: context.expectedRevision,
        resultingRevision: result?.ok ? result.revision : undefined,
        failureClass: result && !result.ok ? result.code : undefined,
      }),
    ).catch(() => undefined);
  } catch {}
}
async function bounded<T>(
  work: () => Promise<T>,
  ms: number,
  code: AuthoringErrorCode,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(failure(code, "The operation timed out.")),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function next(
  draft: GuidebookDraft,
  sections: readonly AuthoringSection[],
  required?: AuthoringSection,
) {
  void required;
  return { ...draft, sections: normalizeSections(sections) };
}
function updateSection(
  draft: GuidebookDraft,
  id: string,
  mutate: (section: AuthoringSection) => AuthoringSection,
) {
  requireSection(draft, id);
  return next(
    draft,
    draft.sections.map((section) =>
      section.id === id ? mutate(section) : section,
    ),
  );
}
function requireSection(draft: GuidebookDraft, id: string) {
  const section = draft.sections.find((item) => item.id === id);
  if (!section)
    throw failure("SECTION_NOT_FOUND", "The section was not found.");
  return section;
}
function requireBlock(section: AuthoringSection, id: string) {
  const block = section.blocks.find((item) => item.id === id);
  if (!block) throw failure("BLOCK_NOT_FOUND", "The block was not found.");
  return block;
}
function sectionName(value: string) {
  const result = value.trim();
  if (!result || result.length > 200)
    throw failure(
      "SECTION_INVALID",
      "Section names must contain 1–200 characters.",
    );
  return result;
}
function failure(code: AuthoringErrorCode, message: string) {
  return Object.assign(new Error(message), { code });
}
function classified(
  error: unknown,
  timeoutCode: AuthoringErrorCode,
): AuthoringResult<never> {
  const code =
    typeof error === "object" && error && "code" in error
      ? (String(error.code) as AuthoringErrorCode)
      : "DRAFT_PERSIST_FAILED";
  return fail(
    code,
    code === timeoutCode || code.endsWith("TIMEOUT")
      ? "timeout"
      : code.includes("CONFLICT")
        ? "conflict"
        : code.includes("NOT_FOUND")
          ? "not-found"
          : code.includes("UNAUTHORIZED")
            ? "unauthorized"
            : code.includes("INVALID") || code === "PUBLICATION_NOT_READY"
              ? "validation-failure"
              : "persistence-failure",
    error instanceof Error ? error.message : "The operation failed.",
  );
}
function fail(
  code: AuthoringErrorCode,
  status: AuthoringFailure["status"],
  message: string,
): AuthoringFailure {
  return { ok: false, status, code, message };
}
function fingerprint(value: unknown) {
  const input = stable(value);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${key}:${stable(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function isDraft(value: unknown): value is GuidebookDraft {
  return Boolean(
    value &&
      typeof value === "object" &&
      "schemaVersion" in value &&
      "revision" in value,
  );
}
export const withGuidebookOperationDeadline = bounded;
