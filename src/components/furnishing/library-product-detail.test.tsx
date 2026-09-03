// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LibraryProductDetail } from "./library-product-detail";

vi.mock("@/app/actions/furnishing-library", () => ({
  archiveLibraryProductAction: vi.fn(),
}));

const baseProduct = {
  id: "product-1",
  name: "Arched Oak Coffee Table",
  status: "draft",
  revision: 1,
  brand: "Example Co",
  color: null,
  finish: null,
  notes: null,
  tags: [],
  source_type: "link_import",
  furnishing_product_categories: { name: "Coffee table" },
  furnishing_product_offers: [],
  furnishing_product_room_compatibility: [],
  furnishing_product_style_tags: [],
};

describe("LibraryProductDetail usage section", () => {
  afterEach(() => cleanup());

  it("explains the governance path and links to it when a draft product has no usage yet", () => {
    render(
      <LibraryProductDetail
        product={baseProduct}
        roomTypes={[]}
        styleTags={[]}
        activity={[]}
        usage={{ packageItems: [], plans: [] }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Usage in room packages and furnishing plans" })).toBeTruthy();
    expect(screen.getByText(/Not yet used in any room package or furnishing plan/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Open this product's governance and approval view" });
    expect(link.getAttribute("href")).toBe("/admin/furnishing/catalog/product-1");
  });

  it("shows usage counts instead of the governance prompt once the product is in use", () => {
    render(
      <LibraryProductDetail
        product={baseProduct}
        roomTypes={[]}
        styleTags={[]}
        activity={[]}
        usage={{ packageItems: [{ id: "a" }, { id: "b" }], plans: [{ id: "p1", name: "123 Main St" }] }}
      />,
    );
    expect(screen.queryByText(/Not yet used/)).toBeNull();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("does not prompt to adopt/approve an archived product", () => {
    render(
      <LibraryProductDetail
        product={{ ...baseProduct, status: "archived" }}
        roomTypes={[]}
        styleTags={[]}
        activity={[]}
        usage={{ packageItems: [], plans: [] }}
      />,
    );
    expect(screen.queryByRole("link", { name: /governance and approval view/ })).toBeNull();
  });
});
