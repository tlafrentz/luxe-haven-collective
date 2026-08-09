// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuidebookPublishingWizard } from "./guidebook-publishing-wizard";

vi.mock("next/image", () => ({
  default: ({
    alt,
    fill: _fill,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    void _fill;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt ?? ""} {...props} />
    );
  },
}));

const mockTemplates = [
  { id: "template-1", name: "Mesa Modern", description: "", category: "modern", tags: [] },
];

vi.mock("@/app/actions/guidebook-templates", () => ({
  getPublishedGuidebookTemplates: vi.fn(async () => mockTemplates),
}));

const properties = [
  {
    id: "property-1",
    name: "Desert Retreat",
    location: "Scottsdale, AZ",
    image: null,
    capabilities: ["hpm"],
    hasActiveGuidebook: false,
  },
];

afterEach(cleanup);

describe("GuidebookPublishingWizard", () => {
  it("uses the seven-step Builder foundation sequence", () => {
    render(
      <GuidebookPublishingWizard
        workspaceId="workspace-1"
        properties={properties}
        createAction={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Welcome to Guidebook Studio!" }),
    ).toBeTruthy();
    for (const label of ["Welcome", "Property", "Style", "Template", "Brand", "Details", "Create"]) {
      expect(screen.getByText(label, { selector: "li" })).toBeTruthy();
    }
  });

  it("supports selecting an existing property and a real template", async () => {
    render(
      <GuidebookPublishingWizard
        workspaceId="workspace-1"
        properties={properties}
        createAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Let's Get Started" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Select Existing Property/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Desert Retreat/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      screen.getByRole("heading", { name: "Let's match your style." }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      screen.getByRole("heading", { name: "Choose a template to get started." }),
    ).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
    expect(await screen.findByText("Mesa Modern")).toBeTruthy();
  });

  it("offers canonical property creation when the workspace is empty", () => {
    render(
      <GuidebookPublishingWizard
        workspaceId="workspace-1"
        properties={[]}
        createAction={vi.fn()}
        createPropertyAction={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Let's Get Started" }));
    expect(screen.getByText("Add your first guidebook property.")).toBeTruthy();
    expect(screen.getByLabelText("Street address (optional)")).toBeTruthy();
    expect(screen.getByLabelText("State / region *").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Time zone *").tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "Arizona" })).toBeTruthy();
    expect(
      screen.getByRole("option", {
        name: "Arizona Time (America/Phoenix)",
      }),
    ).toBeTruthy();
    expect(screen.getByText(/HPM enrollment is not required/i)).toBeTruthy();
  });

  it("prevents a second active guidebook for the same property", () => {
    render(
      <GuidebookPublishingWizard
        workspaceId="workspace-1"
        properties={[{ ...properties[0], hasActiveGuidebook: true, capabilities: ["guidebook", "hpm"] }]}
        createAction={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Let's Get Started" }));
    fireEvent.click(screen.getByRole("button", { name: /Select Existing Property/ }));
    expect(screen.getByRole("button", { name: /already has an active guidebook/ }).hasAttribute("disabled")).toBe(true);
  });
});
