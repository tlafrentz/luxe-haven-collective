// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FinancialExportMenu } from "./financial-export-menu";

afterEach(cleanup);

describe("FinancialExportMenu", () => {
  let printSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let createUrlSpy: ReturnType<typeof vi.spyOn>;
  let revokeUrlSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    createUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    revokeUrlSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  it("triggers the browser print dialog for Overview PDF", async () => {
    const user = userEvent.setup();
    render(<FinancialExportMenu csvSummary="a,b\r\n" csvExpenses="c,d\r\n" filePrefix="financial-intelligence-2026-07" />);
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("menuitem", { name: "Overview PDF" }));
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("downloads the financial summary CSV with the expected filename", async () => {
    const user = userEvent.setup();
    render(<FinancialExportMenu csvSummary="a,b\r\n" csvExpenses="c,d\r\n" filePrefix="financial-intelligence-2026-07" />);
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("menuitem", { name: "Financial summary CSV" }));
    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrlSpy).toHaveBeenCalledTimes(1);
  });
  it("downloads a ZIP package bundling both CSVs", async () => {
    const user = userEvent.setup();
    render(<FinancialExportMenu csvSummary="a,b\r\n" csvExpenses="c,d\r\n" filePrefix="financial-intelligence-2026-07" />);
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("menuitem", { name: "Complete financial package (ZIP)" }));
    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
  it("closes the menu when clicking outside of it", async () => {
    const user = userEvent.setup();
    render(<div><FinancialExportMenu csvSummary="a,b\r\n" csvExpenses="c,d\r\n" filePrefix="financial-intelligence-2026-07" /><button>Outside</button></div>);
    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
