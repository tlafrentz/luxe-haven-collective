import { describe, expect, it, vi } from "vitest";
import {
  isGuidebookMediaGarbageCollectable, parseGuidebookListQuery, parseGuidebookMediaReference,
  resolvePublicGuidebook, sanitizePublicText, sanitizePublicUrl,
} from "./index";

describe("GB-001C guest delivery boundaries", () => {
  it("normalizes bounded list inputs", () => {
    expect(parseGuidebookListQuery({ q: "  Lake  ", page: "-9", pageSize: "900", sort: "bad" })).toEqual({ search: "Lake", status: "all", sort: "updated-desc", page: 1, pageSize: 50 });
  });
  it("accepts only opaque approved media references and preserves historical references", () => {
    expect(parseGuidebookMediaReference({ id: `gbm_${"a".repeat(26)}`, kind: "guidebook-media", mimeType: "image/webp" })?.kind).toBe("guidebook-media");
    expect(parseGuidebookMediaReference({ id: "https://storage/secret", kind: "guidebook-media", mimeType: "image/svg+xml" })).toBeNull();
    expect(isGuidebookMediaGarbageCollectable({ draftReferenceCount: 0, publishedVersionReferenceCount: 1, uploadCompletedAt: "2026-01-01T00:00:00Z", now: "2026-02-01T00:00:00Z" })).toBe(false);
    expect(isGuidebookMediaGarbageCollectable({ draftReferenceCount: 0, publishedVersionReferenceCount: 0, uploadCompletedAt: "2026-01-01T00:00:00Z", now: "2026-02-01T00:00:00Z" })).toBe(true);
  });
  it("sanitizes text and destinations independently of authoring", () => {
    expect(sanitizePublicText(`<p style="position:fixed" onclick="steal()">Hello<script>alert(1)</script></p>`)).toBe("Hello");
    expect(sanitizePublicUrl("javascript:alert(1)", { allowContact: true })).toBeNull();
    expect(sanitizePublicUrl("data:text/html,x")).toBeNull();
    expect(sanitizePublicUrl("https://example.com/path")).toBe("https://example.com/path");
  });
  it("delivers only the exact immutable active version", async () => {
    const repository = { resolveRedirect: vi.fn(async () => null), loadHistoricalVersion: vi.fn(), resolveActive: vi.fn(async () => ({ status: "published", publicUrlStatus: "active", activeVersionId: "v2", version: { id: "v2", version: 2, publishedAt: "2026-07-31T00:00:00Z", snapshot: { schemaVersion: "guidebook-publication-snapshot.v1", sections: [] } } })) };
    await expect(resolvePublicGuidebook(repository, "a".repeat(24))).resolves.toMatchObject({ state: "active", envelope: { version: 2 } });
    repository.resolveActive.mockResolvedValueOnce({ status: "published", publicUrlStatus: "active", activeVersionId: "v3", version: { id: "v2", version: 2, publishedAt: "2026-07-31T00:00:00Z", snapshot: { schemaVersion: "guidebook-publication-snapshot.v1", sections: [] } } });
    await expect(resolvePublicGuidebook(repository, "a".repeat(24))).resolves.toEqual({ state: "unavailable" });
  });
  it("uses indistinguishable unavailable results and bounded redirects", async () => {
    const repository = { resolveActive: vi.fn(async () => null), resolveRedirect: vi.fn(async () => "b".repeat(24)), loadHistoricalVersion: vi.fn() };
    await expect(resolvePublicGuidebook(repository, "NOT VALID")).resolves.toEqual({ state: "unavailable" });
    await expect(resolvePublicGuidebook(repository, "a".repeat(24))).resolves.toEqual({ state: "redirect", slug: "b".repeat(24) });
  });
});
