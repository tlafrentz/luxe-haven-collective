import { normalizePublicSlug, type GuidebookDraft } from "../domain";
import type {
  AuthoringErrorCode,
  AuthoringResult,
  CommandContext,
  GuidebookCommandReceiptRepository,
} from "./authoring";

export type MediaAsset = Readonly<{
  id: string;
  workspaceId: string;
  guidebookId: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  byteSize: number;
  authoringPath: string;
  publicDeliveryPath?: string;
  createdAt: string;
}>;
export type PublicMediaManifest = Readonly<
  Record<string, Readonly<{ url: string; mimeType: string }>>
>;
export type MediaPromotion = Readonly<{
  manifest: PublicMediaManifest;
  newlyPromoted: readonly string[];
}>;
export interface GuidebookMediaRepository {
  createUpload(
    input: Readonly<{
      context: CommandContext;
      assetId: string;
      mimeType: MediaAsset["mimeType"];
      byteSize: number;
      bytes: ArrayBuffer;
    }>,
  ): Promise<MediaAsset>;
  promote(
    input: Readonly<{ context: CommandContext; mediaIds: readonly string[] }>,
  ): Promise<MediaPromotion>;
  cleanupPromotion(
    input: Readonly<{ context: CommandContext; mediaIds: readonly string[] }>,
  ): Promise<
    Readonly<{ cleaned: readonly string[]; failed: readonly string[] }>
  >;
  garbageCollect(
    input: Readonly<{ now: string; graceHours: number; limit: number }>,
  ): Promise<
    Readonly<{
      deleted: readonly string[];
      refused: readonly string[];
      recoverable?: readonly Readonly<{ id: string; code: string }>[];
    }>
  >;
}
export interface GuidebookSlugRepository {
  rotate(
    input: Readonly<{
      context: CommandContext;
      nextSlug: string;
      expiresAt: string;
      fingerprint: string;
    }>,
  ): Promise<Readonly<{ slug: string; redirectExpiresAt: string }>>;
}

export function collectPublishedMediaReferences(draft: GuidebookDraft) {
  return Object.freeze(
    [
      ...new Set(
        draft.sections
          .filter((s) => s.visible)
          .flatMap((s) =>
            s.blocks
              .filter((b) => b.visible && b.type === "image")
              .map((b) => (b.content as { mediaRef: string }).mediaRef),
          )
          .filter(Boolean),
      ),
    ].sort(),
  );
}
export function attachPublicMediaManifest(
  snapshot: Readonly<Record<string, unknown>>,
  manifest: PublicMediaManifest,
) {
  return Object.freeze({ ...snapshot, media: Object.freeze({ ...manifest }) });
}
export async function executeGuidebookMediaGarbageCollection(
  repository: GuidebookMediaRepository,
  input: Readonly<{
    now: string;
    graceHours?: number;
    limit?: number;
    timeoutMs?: number;
  }>,
) {
  const operation = repository.garbageCollect({
      now: input.now,
      graceHours: Math.max(24, input.graceHours ?? 168),
      limit: Math.max(1, Math.min(100, input.limit ?? 25)),
    }),
    timeoutMs = Math.max(1, input.timeoutMs ?? 5000);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Object.assign(new Error("Media cleanup timed out."), {
                code: "MEDIA_GC_TIMEOUT",
              }),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function uploadGuidebookMedia(
  deps: {
    media: GuidebookMediaRepository;
    receipts: GuidebookCommandReceiptRepository;
  },
  context: CommandContext,
  input: Readonly<{ mimeType: string; bytes: ArrayBuffer }>,
): Promise<
  AuthoringResult<Readonly<{ id: string; mimeType: string; byteSize: number }>>
> {
  if (
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
      input.mimeType,
    ) ||
    input.bytes.byteLength < 1 ||
    input.bytes.byteLength > 10_485_760
  )
    return failure("MEDIA_TYPE_UNSUPPORTED");
  const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", input.bytes)),
    )
      .map((value) => value.toString(16).padStart(2, "0"))
      .join(""),
    fingerprint = `${context.guidebookId}:${input.mimeType}:${input.bytes.byteLength}:${digest}`;
  const prior = await deps.receipts.find(
    context.workspaceId,
    context.commandId,
  );
  if (prior) {
    if (
      prior.guidebookId !== context.guidebookId ||
      prior.fingerprint !== fingerprint
    )
      return failure("COMMAND_RECEIPT_CONFLICT");
    if (prior.state === "in-progress")
      return failure("COMMAND_ALREADY_IN_PROGRESS");
    return prior.outcome as AuthoringResult<MediaAsset>;
  }
  await deps.receipts.begin({
    workspaceId: context.workspaceId,
    guidebookId: context.guidebookId,
    commandId: context.commandId,
    actorId: context.actorId,
    operation: "media-upload",
    fingerprint,
    state: "in-progress",
    createdAt: context.enteredAt,
  });
  try {
    const asset = await deps.media.createUpload({
        context,
        assetId: `gbm_${randomBase36(26)}`,
        mimeType: input.mimeType as MediaAsset["mimeType"],
        byteSize: input.bytes.byteLength,
        bytes: input.bytes,
      }),
      value = Object.freeze({
        id: asset.id,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
      }),
      result = { ok: true as const, status: "completed" as const, value };
    await deps.receipts.complete(
      context.workspaceId,
      context.commandId,
      result,
    );
    return result;
  } catch {
    const result = failure("MEDIA_UPLOAD_FAILED");
    await deps.receipts.complete(
      context.workspaceId,
      context.commandId,
      result,
    );
    return result;
  }
}
export async function rotateGuidebookPublicSlug(
  deps: {
    slugs: GuidebookSlugRepository;
    receipts: GuidebookCommandReceiptRepository;
  },
  context: CommandContext,
  input: Readonly<{ slug: string; expiresAt: string }>,
) {
  const slug = normalizePublicSlug(input.slug);
  if (!slug) return failure("PUBLIC_SLUG_INVALID");
  const fingerprint = `${context.guidebookId}:${slug}:${input.expiresAt}`,
    prior = await deps.receipts.find(context.workspaceId, context.commandId);
  if (prior) {
    if (
      prior.guidebookId !== context.guidebookId ||
      prior.fingerprint !== fingerprint
    )
      return failure("COMMAND_RECEIPT_CONFLICT");
    if (prior.state === "in-progress")
      return failure("COMMAND_ALREADY_IN_PROGRESS");
    return prior.outcome;
  }
  await deps.receipts.begin({
    workspaceId: context.workspaceId,
    guidebookId: context.guidebookId,
    commandId: context.commandId,
    actorId: context.actorId,
    operation: "public-slug-rotate",
    fingerprint,
    state: "in-progress",
    createdAt: context.enteredAt,
  });
  try {
    const value = await deps.slugs.rotate({
        context,
        nextSlug: slug,
        expiresAt: input.expiresAt,
        fingerprint,
      }),
      result = { ok: true as const, status: "completed" as const, value };
    await deps.receipts.complete(
      context.workspaceId,
      context.commandId,
      result,
    );
    return result;
  } catch {
    const result = failure("PUBLIC_SLUG_CONFLICT");
    await deps.receipts.complete(
      context.workspaceId,
      context.commandId,
      result,
    );
    return result;
  }
}
function failure(code: AuthoringErrorCode) {
  return Object.freeze({
    ok: false as const,
    status: "validation-failure" as const,
    code,
    message: "The Guidebook operation could not be completed.",
  });
}
function randomBase36(length: number) {
  let value = "";
  while (value.length < length)
    value += Math.floor(Math.random() * 36).toString(36);
  return value.slice(0, length);
}
