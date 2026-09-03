// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LibraryProductDetail } from "./library-product-detail";

vi.mock("@/app/actions/furnishing-library", () => ({
  archiveLibraryProductAction: vi.fn(),
  updateLibraryProductOfferAction: vi.fn(),
}));

const baseProduct = {
  id: "product-1",
  name: "Arched Oak Coffee Table",
  status: "draft",
  scope: "platform",
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
  furnishing_product_media: [],
};

describe("LibraryProductDetail usage section", () => {
  afterEach(() => cleanup());

  it("explains the governance path and links to it when a draft product has no usage yet", () => {
    render(
      <LibraryProductDetail
        product={baseProduct}
        roomTypes={[]}
        styleTags={[]}
        retailers={[]}
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
        retailers={[]}
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
        retailers={[]}
        activity={[]}
        usage={{ packageItems: [], plans: [] }}
      />,
    );
    expect(screen.queryByRole("link", { name: /governance and approval view/ })).toBeNull();
  });
});

describe("LibraryProductDetail price editing", () => {
  afterEach(() => cleanup());

  const productWithOffer = {
    ...baseProduct,
    furnishing_product_offers: [
      { id: "offer-1", listed_price_minor: 3998, currency: "USD", availability: "in_stock", sku: "ABC-1", retailer_id: null, last_verified_at: null },
    ],
  };

  it("pre-fills the editable price field in dollars, not raw minor units", () => {
    render(
      <LibraryProductDetail
        product={productWithOffer}
        roomTypes={[]}
        styleTags={[]}
        retailers={[]}
        activity={[]}
        usage={{ packageItems: [], plans: [] }}
      />,
    );
    const priceInput = screen.getByLabelText("Price") as HTMLInputElement;
    expect(priceInput.value).toBe("39.98");
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("does not offer direct offer editing for a workspace-scope product", () => {
    render(
      <LibraryProductDetail
        product={{ ...productWithOffer, scope: "workspace" }}
        roomTypes={[]}
        styleTags={[]}
        retailers={[]}
        activity={[]}
        usage={{ packageItems: [], plans: [] }}
      />,
    );
    expect(screen.queryByLabelText("Price")).toBeNull();
  });

  it("does not offer offer editing for an archived product", () => {
    render(
      <LibraryProductDetail
        product={{ ...productWithOffer, status: "archived" }}
        roomTypes={[]}
        styleTags={[]}
        retailers={[]}
        activity={[]}
        usage={{ packageItems: [], plans: [] }}
      />,
    );
    expect(screen.queryByLabelText("Price")).toBeNull();
  });
});
