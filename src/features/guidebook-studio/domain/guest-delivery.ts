export const GUIDEBOOK_PUBLIC_SLUG_PATTERN = /^[a-z0-9]{24,64}$/;
export const GUIDEBOOK_MEDIA_REFERENCE_PATTERN = /^gbm_[a-z0-9]{26}$/;

export type GuidebookMediaReference = Readonly<{
  id: string;
  kind: "guidebook-media";
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
}>;

export type GuidebookListQuery = Readonly<{
  search: string;
  status: "all" | "draft" | "published" | "archived";
  sort: "updated-desc" | "updated-asc" | "name-asc" | "published-desc";
  page: number;
  pageSize: number;
}>;

export function normalizePublicSlug(value: string) {
  const normalized = value.trim().toLowerCase();
  return GUIDEBOOK_PUBLIC_SLUG_PATTERN.test(normalized) ? normalized : null;
}

export function parseGuidebookMediaReference(value: unknown): GuidebookMediaReference | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const mimeType = String(input.mimeType ?? "");
  if (
    input.kind !== "guidebook-media" ||
    !GUIDEBOOK_MEDIA_REFERENCE_PATTERN.test(String(input.id ?? "")) ||
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(mimeType)
  ) return null;
  return Object.freeze({ id: String(input.id), kind: "guidebook-media" as const, mimeType: mimeType as GuidebookMediaReference["mimeType"] });
}

export function isGuidebookMediaGarbageCollectable(input: Readonly<{
  draftReferenceCount: number;
  publishedVersionReferenceCount: number;
  uploadCompletedAt: string;
  now: string;
  gracePeriodHours?: number;
}>) {
  const grace = Math.max(24, input.gracePeriodHours ?? 168) * 3_600_000;
  return input.draftReferenceCount === 0 && input.publishedVersionReferenceCount === 0 &&
    Date.parse(input.now) - Date.parse(input.uploadCompletedAt) >= grace;
}

export function parseGuidebookListQuery(input: Readonly<Record<string, string | undefined>>): GuidebookListQuery {
  const status = ["draft", "published", "archived"].includes(input.status ?? "") ? input.status as GuidebookListQuery["status"] : "all";
  const sort = ["updated-asc", "name-asc", "published-desc"].includes(input.sort ?? "") ? input.sort as GuidebookListQuery["sort"] : "updated-desc";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(input.page ?? "1", 10) || 1));
  const pageSize = Math.max(10, Math.min(50, Number.parseInt(input.pageSize ?? "25", 10) || 25));
  return Object.freeze({ search: (input.q ?? "").trim().slice(0, 120), status, sort, page, pageSize });
}

/** Public rendering treats all authored text as hostile, even after publication validation. */
export function sanitizePublicText(value: unknown, maximum = 20_000) {
  return String(value ?? "")
    .slice(0, maximum)
    .replace(/<(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?(?:script|style|iframe|object|embed|svg|math)[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

export function sanitizePublicUrl(value: unknown, options: Readonly<{ allowContact?: boolean; allowRelative?: boolean }> = {}) {
  const candidate = String(value ?? "").trim().slice(0, 2048);
  if (options.allowRelative && /^\/(?!\/)[a-z0-9/_?&=%#.+~-]*$/i.test(candidate)) return candidate;
  try {
    const parsed = new URL(candidate);
    const protocols = options.allowContact ? ["https:", "http:", "tel:", "mailto:"] : ["https:", "http:"];
    return protocols.includes(parsed.protocol) ? parsed.toString() : null;
  } catch { return null; }
}
