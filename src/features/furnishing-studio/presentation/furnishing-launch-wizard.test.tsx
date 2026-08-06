// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FurnishingLaunchWizard } from "./furnishing-launch-wizard";

vi.mock("next/image", () => ({
  default: ({
    alt,
    fill: _fill,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    void _fill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt ?? ""} {...props} />;
  },
}));

afterEach(cleanup);

const properties = [
  {
    id: "property-1",
    name: "Desert Retreat",
    city: "Scottsdale",
    state: "AZ",
    bedrooms: 3,
    bathrooms: 2,
    featured_image: null,
  },
];
const packages = [
  {
    id: "package-1",
    name: "Elevated",
    description: "Curated and installed",
    starting_budget: 15000,
    budget_tier: "premium",
  },
];
const variants = [
  {
    id: "variant-1",
    package_id: "package-1",
    name: "3 Bedroom",
    estimated_budget: 15000,
    estimated_install_days: 2,
  },
];
const rooms = [{ id: "room-1", variant_id: "variant-1", name: "Living Room" }];

describe("FurnishingLaunchWizard", () => {
  it("uses the launch-specific setup sequence", () => {
    render(
      <FurnishingLaunchWizard
        properties={properties}
        packages={packages}
        variants={variants}
        rooms={rooms}
        createAction={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Confirm your property" }),
    ).toBeTruthy();
    expect(screen.getByText("Package", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("Rooms", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("Budget", { selector: "span" })).toBeTruthy();
    expect(screen.queryByText("Import portfolio", { exact: false })).toBeNull();
  });

  it("moves from property confirmation into package selection", () => {
    render(
      <FurnishingLaunchWizard
        properties={properties}
        packages={packages}
        variants={variants}
        rooms={rooms}
        createAction={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Desert Retreat/ }));
    fireEvent.click(screen.getByRole("button", { name: /Confirm & continue/ }));
    expect(
      screen.getByRole("heading", { name: "Choose your furnishing package" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Elevated/ })).toBeTruthy();
  });
});
