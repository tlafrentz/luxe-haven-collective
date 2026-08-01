import { describe, expect, it } from "vitest";
import { buildGuidebookInsertionDraft } from "./domain";
const url = `/g/${"a".repeat(24)}`;
describe("Guidebook Communications insertion journey", () => {
  it("inserts the authorized stable URL into a draft without a send command", () => {
    const result = buildGuidebookInsertionDraft({
      currentBody: "Welcome",
      requestedUrl: url,
      publishedUrl: url,
    });
    expect(result).toEqual({
      state: "inserted",
      body: `Welcome\n\nGuest guidebook:\n\n${url}`,
      focusTarget: "message-body",
    });
    expect(result).not.toHaveProperty("send");
  });
  it("preserves the current draft for other-owner, stale, empty, and unavailable conversations", () => {
    for (const input of [
      {
        currentBody: "Keep me",
        requestedUrl: url,
        publishedUrl: `/g/${"b".repeat(24)}`,
      },
      { currentBody: "Keep me", requestedUrl: url },
      { currentBody: "Keep me" },
    ])
      expect(buildGuidebookInsertionDraft(input)).toMatchObject({
        body: "Keep me",
      });
  });
  it("is idempotent and preserves operator input", () => {
    const body = `Draft\n\nGuest guidebook:\n\n${url}`;
    expect(
      buildGuidebookInsertionDraft({
        currentBody: body,
        requestedUrl: url,
        publishedUrl: url,
      }),
    ).toMatchObject({ state: "unchanged", body });
  });
});
