import { describe, expect, it } from "vitest";
import type { PublishedArtifactEnvelope } from "@/platform/artifact-rendering";
import { MESA_MODERN_TOKENS } from "@/features/template-library";
import {
  guidebookPublicRenderer,
  type GuidebookArtifactPayload,
} from "./domain/public-guidebook";

const artifact: PublishedArtifactEnvelope<GuidebookArtifactPayload> = {
  artifactType: "guidebook",
  artifactVersion: "guidebook-publication-snapshot.v1",
  rendererVersion: "guidebook-web-renderer.v1",
  publishedAt: "2026-07-26T12:00:00.000Z",
  version: 3,
  payload: {
    title: "Lake House Guide",
    description: "Welcome to the lake.",
    brand: {
      primaryColor: "#123456",
      accentColor: "#abcdef",
      logoUrl: "https://cdn.example.com/logo.png",
    },
    property: { name: "Stale property name" },
    propertyProjection: {
      resolvedValues: {
        propertyName: "Lakeside Retreat",
        checkInTime: "4:00 PM",
        hostContact: "+15551234567",
      },
    },
    sections: [
      {
        id: "wifi",
        section_key: "wifi",
        title: "Wi-Fi",
        position: 2,
        blocks: [
          {
            id: "unsafe",
            type: "link",
            position: 2,
            content: { label: "Unsafe", url: "javascript:alert(1)" },
          },
          {
            id: "list",
            type: "rich-text",
            position: 1,
            content: { markdown: "One\nTwo" },
          },
        ],
      },
      {
        id: "welcome",
        section_key: "welcome",
        title: "Welcome",
        position: 1,
        blocks: [
          {
            id: "heading",
            type: "heading",
            position: 1,
            content: { text: "Your stay starts here" },
          },
        ],
      },
      { id: "hidden", title: "Hidden", position: 0, visible: false },
    ],
  },
};

describe("public guidebook renderer", () => {
  it("renders a deterministic public view from the immutable artifact", () => {
    const view = guidebookPublicRenderer.render(artifact);

    expect(view.propertyName).toBe("Lakeside Retreat");
    expect(view.sections.map((section) => section.title)).toEqual([
      "Welcome",
      "Wi-Fi",
    ]);
    expect(view.sections[1]?.blocks[0]).toMatchObject({
      type: "paragraph",
      text: "One\nTwo",
    });
    expect(view.meta).toEqual({
      guidebookVersion: 3,
      publishedAt: artifact.publishedAt,
      artifactVersion: artifact.artifactVersion,
      rendererVersion: artifact.rendererVersion,
    });
    expect(Object.isFrozen(view)).toBe(true);
  });

  it("does not expose unsafe public links or the raw publication payload", () => {
    const view = guidebookPublicRenderer.render(artifact);
    const unsafeLink = view.sections[1]?.blocks[1];

    expect(unsafeLink).toMatchObject({ type: "link", label: "Unsafe" });
    expect(unsafeLink).not.toHaveProperty("url");
    expect(view).not.toHaveProperty("payload");
    expect(JSON.stringify(view)).not.toContain("javascript:alert");
  });
  it("renders all nine v1 blocks through the hostile public boundary and resolves images only from the immutable manifest", () => {
    const malicious = `<img src=x onerror=steal()><script>bad()</script>Safe`,
      mediaRef = `gbm_${"a".repeat(26)}`,
      view = guidebookPublicRenderer.render({
        ...artifact,
        payload: {
          ...artifact.payload,
          media: {
            [mediaRef]: {
              url: "https://cdn.example.com/immutable.webp",
              mimeType: "image/webp",
            },
          },
          sections: [
            {
              id: "all",
              title: "<b>All blocks</b>",
              blocks: [
                { id: "h", type: "heading", content: { text: malicious } },
                { id: "r", type: "rich-text", content: { text: malicious } },
                {
                  id: "i",
                  type: "image",
                  content: { mediaRef, alt: malicious },
                },
                {
                  id: "instruction",
                  type: "instruction",
                  content: {
                    text: "Steps",
                    steps: [{ id: "1", text: malicious }],
                  },
                },
                {
                  id: "contact",
                  type: "contact",
                  content: { name: malicious, phone: "+15551234567" },
                },
                {
                  id: "location",
                  type: "location",
                  content: { text: malicious, mapUrl: "javascript:bad()" },
                },
                {
                  id: "link",
                  type: "link",
                  content: { label: malicious, url: "data:text/html,bad" },
                },
                {
                  id: "callout",
                  type: "callout",
                  content: { text: malicious },
                },
                {
                  id: "checklist",
                  type: "checklist",
                  content: { items: [{ id: "1", text: malicious }] },
                },
              ],
            },
          ],
        },
      });
    expect(view.sections[0]?.blocks.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "image",
      "instruction",
      "contact",
      "location",
      "link",
      "callout",
      "checklist",
    ]);
    expect(JSON.stringify(view)).not.toMatch(
      /<script|onerror|javascript:|data:text|bad\(\)/,
    );
    expect(view.sections[0]?.blocks[2]).toMatchObject({
      type: "image",
      url: "https://cdn.example.com/immutable.webp",
    });
    const untrusted = guidebookPublicRenderer.render({
      ...artifact,
      payload: {
        ...artifact.payload,
        sections: [
          {
            id: "image",
            title: "Image",
            blocks: [
              {
                id: "i",
                type: "image",
                content: {
                  mediaRef,
                  url: "https://attacker.example/x",
                  alt: "x",
                },
              },
            ],
          },
        ],
      },
    });
    expect(untrusted.sections[0]?.blocks[0]).not.toHaveProperty("url");
  });
  it("defaults theme colors to the Mesa Modern tokens when no brand colors are set", () => {
    const view = guidebookPublicRenderer.render({
      ...artifact,
      payload: { ...artifact.payload, brand: {} },
    });
    expect(view.theme.primaryColor).toBe(MESA_MODERN_TOKENS.colors.primary);
    expect(view.theme.accentColor).toBe(MESA_MODERN_TOKENS.colors.accent);
  });
  it("still honors custom brand colors when set", () => {
    const view = guidebookPublicRenderer.render(artifact);
    expect(view.theme.primaryColor).toBe("#123456");
    expect(view.theme.accentColor).toBe("#abcdef");
  });
});
