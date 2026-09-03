// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { AddProductFlow } from "./add-product-flow";
import {
  validateProductLinkAction,
  extractProductFromLinkAction,
  createLibraryProductAction,
} from "@/app/actions/furnishing-library";

vi.mock("@/app/actions/furnishing-library", () => ({
  validateProductLinkAction: vi.fn(),
  extractProductFromLinkAction: vi.fn(),
  createLibraryProductAction: vi.fn(),
}));

const categories = [{ id: "cat-1", name: "Coffee table" }];
const retailers = [{ id: "ret-1", name: "Amazon" }];
const roomTypes = [{ id: "living_room", name: "Living room" }];
const styleTags = [{ id: "style-1", name: "Warm modern" }];

describe("AddProductFlow interaction and accessibility", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("has no automated accessibility violations on the initial paste-link step", async () => {
    const { container } = render(
      <AddProductFlow categories={categories} retailers={retailers} roomTypes={roomTypes} styleTags={styleTags} />,
    );
    expect(screen.getByRole("heading", { name: "Add a product" })).toBeTruthy();
    expect(
      (await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);
  });

  it("shows an inline, associated error and never proceeds when the link is invalid", async () => {
    vi.mocked(validateProductLinkAction).mockResolvedValue({ ok: false, message: "Enter a valid product link." });
    vi.mocked(extractProductFromLinkAction).mockResolvedValue({ status: "invalid_url" });
    render(<AddProductFlow categories={categories} retailers={retailers} roomTypes={roomTypes} styleTags={styleTags} />);
    const input = screen.getByLabelText("Product link");
    await userEvent.type(input, "not a url");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    const error = await screen.findByRole("alert");
    expect(error.textContent).toBe("Enter a valid product link.");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByRole("heading", { name: "Review product" })).toBeNull();
  });

  it("moves to the review step, prefills extracted fields, and never clears the submitted URL on partial extraction", async () => {
    vi.mocked(validateProductLinkAction).mockResolvedValue({ ok: true });
    vi.mocked(extractProductFromLinkAction).mockResolvedValue({
      status: "manual",
      submittedUrl: "https://www.example.com/product",
      canonicalUrl: "https://www.example.com/product",
      extracted: null,
      retailerId: null,
    });
    render(<AddProductFlow categories={categories} retailers={retailers} roomTypes={roomTypes} styleTags={styleTags} />);
    await userEvent.type(screen.getByLabelText("Product link"), "https://www.example.com/product");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Review product" })).toBeTruthy();
    expect(screen.getByText(/couldn't automatically read this page/i)).toBeTruthy();
    expect(screen.getByText(/https:\/\/www\.example\.com\/product/)).toBeTruthy();
  });

  it("requires at least one room and a product type before saving, and the review form has no automated accessibility violations", async () => {
    vi.mocked(validateProductLinkAction).mockResolvedValue({ ok: true });
    vi.mocked(extractProductFromLinkAction).mockResolvedValue({
      status: "extracted",
      submittedUrl: "https://www.example.com/product",
      canonicalUrl: "https://www.example.com/product",
      extracted: { source: "json_ld", confidence: "high", name: "Test Product" },
      retailerId: "ret-1",
    });
    const { container } = render(
      <AddProductFlow categories={categories} retailers={retailers} roomTypes={roomTypes} styleTags={styleTags} />,
    );
    await userEvent.type(screen.getByLabelText("Product link"), "https://www.example.com/product");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Review product" });

    expect(screen.getByRole("group", { name: "Room (choose at least one)" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Living room" })).toBeTruthy();

    expect(
      (await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);
  });

  it("offers Open existing / Update existing / Save anyway when the RPC reports a duplicate", async () => {
    vi.mocked(validateProductLinkAction).mockResolvedValue({ ok: true });
    vi.mocked(extractProductFromLinkAction).mockResolvedValue({
      status: "extracted",
      submittedUrl: "https://www.example.com/product",
      canonicalUrl: "https://www.example.com/product",
      extracted: { source: "json_ld", confidence: "high", name: "Test Product" },
      retailerId: null,
    });
    vi.mocked(createLibraryProductAction).mockResolvedValue({
      ok: true,
      status: "duplicate",
      existingProductId: "existing-1",
      existingProductName: "Test Product",
    });
    render(<AddProductFlow categories={categories} retailers={retailers} roomTypes={roomTypes} styleTags={styleTags} />);
    await userEvent.type(screen.getByLabelText("Product link"), "https://www.example.com/product");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Review product" });
    await userEvent.type(screen.getByLabelText("Product name"), "Test Product");
    await userEvent.selectOptions(screen.getByLabelText("Product type"), "cat-1");
    await userEvent.click(screen.getByRole("checkbox", { name: "Living room" }));
    await userEvent.click(screen.getByRole("button", { name: "Save product" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "This product may already exist" })).toBeTruthy());
    expect(screen.getByRole("link", { name: "Open existing product" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Update existing product" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /save anyway/i })).toBeTruthy();
  });

  it("shows a polite, immediate confirmation on save and a link to the new product", async () => {
    vi.mocked(validateProductLinkAction).mockResolvedValue({ ok: true });
    vi.mocked(extractProductFromLinkAction).mockResolvedValue({
      status: "extracted",
      submittedUrl: "https://www.example.com/product",
      canonicalUrl: "https://www.example.com/product",
      extracted: { source: "json_ld", confidence: "high", name: "Test Product" },
      retailerId: null,
    });
    vi.mocked(createLibraryProductAction).mockResolvedValue({ ok: true, status: "created", productId: "new-product-1" });
    render(<AddProductFlow categories={categories} retailers={retailers} roomTypes={roomTypes} styleTags={styleTags} />);
    await userEvent.type(screen.getByLabelText("Product link"), "https://www.example.com/product");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Review product" });
    await userEvent.type(screen.getByLabelText("Product name"), "Test Product");
    await userEvent.selectOptions(screen.getByLabelText("Product type"), "cat-1");
    await userEvent.click(screen.getByRole("checkbox", { name: "Living room" }));
    await userEvent.click(screen.getByRole("button", { name: "Save product" }));

    const confirmation = await screen.findByRole("status");
    expect(confirmation.textContent).toContain("Product saved");
    expect(screen.getByRole("link", { name: "View product" }).getAttribute("href")).toBe("/admin/furnishing/products/new-product-1");
  });
});
