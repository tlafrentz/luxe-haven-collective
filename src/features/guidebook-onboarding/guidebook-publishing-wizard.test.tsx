// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const properties = [
  {
    id: "property-1",
    name: "Desert Retreat",
    location: "Scottsdale, AZ",
    image: null,
  },
];

afterEach(cleanup);

describe("GuidebookPublishingWizard", () => {
  it("uses an editorial creation sequence instead of workspace setup language", () => {
    render(
      <GuidebookPublishingWizard
        workspaceId="workspace-1"
        properties={properties}
        createAction={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Choose your property" }),
    ).toBeTruthy();
    expect(screen.getByText("Property", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("Brand", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("Publish", { selector: "span" })).toBeTruthy();
    expect(screen.queryByText("Import portfolio", { exact: false })).toBeNull();
  });

  it("moves from property selection into visual brand direction", () => {
    render(
      <GuidebookPublishingWizard
        workspaceId="workspace-1"
        properties={properties}
        createAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Desert Retreat/ }));
    fireEvent.click(screen.getByRole("button", { name: /Save & continue/ }));

    expect(
      screen.getByRole("heading", { name: "Let’s match your style" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Luxury/ })).toBeTruthy();
  });
});
