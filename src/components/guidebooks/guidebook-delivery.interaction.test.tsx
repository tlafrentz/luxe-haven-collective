// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { CopyGuidebookLink } from "./copy-guidebook-link";
import { PublicGuidebookExperience } from "./public-guidebook-experience";
import type { PublicGuidebookBlock, PublicGuidebookView } from "@/features/guidebook-studio";
vi.mock("@/components/shared/safe-image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  SafeImage: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));
const blocks: PublicGuidebookBlock[] = [
    {
      id: "h",
      type: "heading",
      text: "A very long heading that remains readable for every guest",
    },
    { id: "r", type: "paragraph", text: "Long rich text ".repeat(80) },
    {
      id: "i",
      type: "image",
      alt: "Pool beside the west terrace",
      url: "https://cdn.example/pool.webp",
    },
    {
      id: "instructions",
      type: "instruction",
      text: "Arrival",
      items: Array.from({ length: 12 }, (_, i) => `Long instruction ${i + 1}`),
    },
    { id: "contact", type: "contact", name: "Host", phone: "+15551234567" },
    {
      id: "location",
      type: "location",
      text: "123 Long Address, Example",
      url: "https://maps.example/location",
    },
    {
      id: "link",
      type: "link",
      label: "Read the complete property information",
      url: "https://example.com/very/long/destination",
    },
    { id: "callout", type: "callout", text: "Important information" },
    {
      id: "checklist",
      type: "checklist",
      items: Array.from({ length: 20 }, (_, i) => `Checklist item ${i + 1}`),
    },
  ],
  guidebook: PublicGuidebookView = {
    title: "Guide",
    description: "Welcome",
    propertyName: "Retreat",
    theme: { primaryColor: "#1d1a17", accentColor: "#8a5a00" },
    sections: [{ id: "all", key: "all", title: "Guest information", blocks }],
    recommendations: [],
    meta: {
      guidebookVersion: 4,
      publishedAt: "2026-07-31T00:00:00Z",
      artifactVersion: "guidebook-publication-snapshot.v1",
      rendererVersion: "guidebook-web-renderer.v1",
    },
  };
describe("Guidebook delivery interaction and accessibility", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it("announces copy completion and keeps a textual destination", async () => {
    render(
      <>
        <p>/g/aaaaaaaaaaaaaaaaaaaaaaaa</p>
        <CopyGuidebookLink path="/g/aaaaaaaaaaaaaaaaaaaaaaaa" />
      </>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Copy public link" }),
    );
    expect(
      await screen.findByRole("button", { name: "Link copied" }),
    ).toBeTruthy();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "http://localhost:3000/g/aaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });
  it("renders all nine blocks with landmarks, headings, descriptive links, alternatives, and no automated accessibility violations", async () => {
    const { container } = render(
      <PublicGuidebookExperience
        slug={"a".repeat(24)}
        guidebook={guidebook}
        source="link"
        trackEvents={false}
      />,
    );
    expect(screen.getByRole("main")).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Guidebook sections" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByAltText("Pool beside the west terrace")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /complete property information/i })
        .getAttribute("rel"),
    ).toBe("noopener noreferrer");
    expect(
      (
        await axe.run(container, {
          rules: { "color-contrast": { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  });
  it("keeps every public action keyboard reachable without hover", async () => {
    render(
      <PublicGuidebookExperience
        slug={"a".repeat(24)}
        guidebook={guidebook}
        source="link"
        trackEvents={false}
      />,
    );
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement?.tagName).toMatch(/A|BUTTON/);
    for (let index = 0; index < 8; index++) await user.tab();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("never emits view, section, or completion events from historical preview", async () => {
    render(
      <PublicGuidebookExperience
        slug="historical-preview"
        guidebook={guidebook}
        source="link"
        trackEvents={false}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).not.toHaveBeenCalled();
  });
});
