import { describe, expect, it } from "vitest";
import type { PublishedArtifactEnvelope } from "@/platform/artifact-rendering";
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
            type: "rich_text",
            position: 1,
            content: { variant: "bullet-list", markdown: "- One\n* Two" },
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
      type: "list",
      items: ["One", "Two"],
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
});
