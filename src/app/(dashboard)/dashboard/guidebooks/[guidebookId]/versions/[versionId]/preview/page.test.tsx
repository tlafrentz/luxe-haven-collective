import { beforeEach, describe, expect, it, vi } from "vitest";
const { preview, notFound } = vi.hoisted(() => ({
  preview: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/app/actions/guidebook-delivery", () => ({
  getHistoricalGuidebookPreviewRequest: preview,
}));
vi.mock("next/navigation", () => ({ notFound }));
import HistoricalPreview from "./page";
const params = Promise.resolve({
    guidebookId: "guidebook-owner",
    versionId: "version-owner",
  }),
  envelope = {
    artifactType: "guidebook",
    artifactVersion: "guidebook-publication-snapshot.v1",
    rendererVersion: "guidebook-web-renderer.v1",
    publishedAt: "2026-07-31T00:00:00Z",
    version: 2,
    payload: {
      schemaVersion: "guidebook-publication-snapshot.v1",
      title: "Guide",
      property: { name: "Retreat" },
      sections: [],
    },
  };
describe("historical preview route", () => {
  beforeEach(() => {
    preview.mockReset();
    notFound.mockClear();
  });
  it("delegates owner authorization and labels immutable history", async () => {
    preview.mockResolvedValue({ ok: true, envelope, historical: true });
    const element = await HistoricalPreview({ params });
    expect(element.type).toBe("div");
    const banner = element.props.children[0];
    expect(banner.props.role).toBe("status");
    expect(banner.props.children[0].props.children.join("")).toContain(
      "Historical preview",
    );
    expect(banner.props.children[1].props.children).toContain(
      "immutable version",
    );
    expect(preview).toHaveBeenCalledWith("guidebook-owner", "version-owner");
  });
  it.each([
    "anonymous",
    "other-owner",
    "missing-guidebook",
    "missing-version",
    "mismatched-version",
  ])("uses the same not-found boundary for %s", async () => {
    preview.mockResolvedValue({ ok: false, code: "HIDDEN" });
    await expect(HistoricalPreview({ params })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFound).toHaveBeenCalledOnce();
  });
});
