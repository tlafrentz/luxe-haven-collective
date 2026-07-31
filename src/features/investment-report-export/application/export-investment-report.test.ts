import { describe, expect, it, vi } from "vitest";
import { exportInvestmentReport } from "./export-investment-report";
import { InvestmentReportExportError } from "../domain/investment-report-export";
import { investmentReportExportFixture } from "../testing/export-fixtures";

const valid = new TextEncoder().encode("%PDF-1.7\n" + "x".repeat(200));
describe("exportInvestmentReport terminal boundary", () => {
  it("exports active and archived snapshots without mutation", async () => {
    for (const report of [investmentReportExportFixture("complete-purchase"), investmentReportExportFixture("no-external-data")]) {
      const before = structuredClone(report.snapshot), result = await exportInvestmentReport({ report, renderer: async () => valid });
      expect(result.bytes).toEqual(valid); expect(report.snapshot).toEqual(before);
    }
  });
  it("independently rejects a never-settling renderer", async () => {
    await expect(exportInvestmentReport({ report: investmentReportExportFixture("complete-purchase"), renderer: () => new Promise(() => undefined), deadlineMs: 15 })).rejects.toMatchObject({ code: "EXPORT_GENERATION_TIMEOUT" });
  });
  it.each([new Uint8Array(), new TextEncoder().encode("not-a-pdf"), new Uint8Array(8_000_001)])("rejects invalid renderer output", async bytes => {
    await expect(exportInvestmentReport({ report: investmentReportExportFixture("complete-purchase"), renderer: async () => bytes })).rejects.toMatchObject({ code: "EXPORT_RENDER_FAILED" });
  });
  it("classifies renderer exceptions and permits a safe retry", async () => {
    const renderer = vi.fn().mockRejectedValueOnce(new Error("secret renderer path")).mockResolvedValueOnce(valid), report = investmentReportExportFixture("complete-purchase");
    await expect(exportInvestmentReport({ report, renderer })).rejects.toMatchObject({ code: "EXPORT_RENDER_FAILED" });
    await expect(exportInvestmentReport({ report, renderer })).resolves.toMatchObject({ bytes: valid });
  });
  it("isolates synchronous and asynchronous telemetry failures", async () => {
    await expect(exportInvestmentReport({ report: investmentReportExportFixture("complete-purchase"), renderer: async () => valid, telemetry: () => { throw new Error("telemetry"); } })).resolves.toBeDefined();
    await expect(exportInvestmentReport({ report: investmentReportExportFixture("complete-purchase"), renderer: async () => valid, telemetry: async () => { throw new Error("telemetry"); } })).resolves.toBeDefined();
  });
  it("uses one classified timeout result", async () => {
    try { await exportInvestmentReport({ report: investmentReportExportFixture("complete-purchase"), renderer: () => new Promise(() => undefined), deadlineMs: 5 }); }
    catch (error) { expect(error).toBeInstanceOf(InvestmentReportExportError); expect((error as InvestmentReportExportError).code).toBe("EXPORT_GENERATION_TIMEOUT"); }
  });
});
