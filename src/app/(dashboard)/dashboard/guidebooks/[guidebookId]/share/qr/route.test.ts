import { beforeEach, describe, expect, it, vi } from "vitest";
const { editor } = vi.hoisted(() => ({ editor: vi.fn() }));
vi.mock("@/app/actions/guidebook-studio", () => ({
  getGuidebookEditorRequest: editor,
}));
import { GET } from "./route";
const request = new Request(
    "https://luxe.example/dashboard/guidebooks/guidebook-owner/share/qr",
  ),
  context = { params: Promise.resolve({ guidebookId: "guidebook-owner" }) };
describe("Guidebook QR route", () => {
  beforeEach(() => editor.mockReset());
  it("delegates authorization and returns the owner QR artifact", async () => {
    editor.mockResolvedValue({
      ok: true,
      guidebook: {
        status: "published",
        public_url_status: "active",
        public_slug: "a".repeat(24),
      },
    });
    const response = await GET(request, context);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(response.headers.get("x-guidebook-destination")).toBe(
      `https://luxe.example/stay/${"a".repeat(24)}?source=qr`,
    );
    expect(editor).toHaveBeenCalledWith("guidebook-owner");
  });
  it.each(["anonymous", "other-owner", "missing"])(
    "returns the same response for %s denial",
    async () => {
      editor.mockResolvedValue({ ok: false, code: "hidden" });
      const response = await GET(request, context);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Unavailable");
      expect([...response.headers]).not.toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.stringMatching(/owner|guidebook-id|revision/i),
            expect.anything(),
          ]),
        ]),
      );
    },
  );
  it("does not disclose unpublished or archived state", async () => {
    for (const status of ["draft", "archived"]) {
      editor.mockResolvedValue({
        ok: true,
        guidebook: {
          status,
          public_url_status: "unavailable",
          public_slug: "a".repeat(24),
        },
      });
      const response = await GET(request, context);
      expect([response.status, await response.text()]).toEqual([
        404,
        "Unavailable",
      ]);
    }
  });
});
