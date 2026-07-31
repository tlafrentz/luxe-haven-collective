import { describe, expect, it, vi } from "vitest";
import { generateShareCredential, type InvestmentReportShareGrant } from "../domain/investment-report-share";
import { resolveSharedInvestmentReport, type SharedAccessRepository } from "./resolve-shared-investment-report";
import { investmentReportExportFixture } from "@/features/investment-report-export/testing/export-fixtures";

function setup(overrides: Partial<InvestmentReportShareGrant> = {}) {
  const credential = generateShareCredential(), report = investmentReportExportFixture("complete-purchase");
  const grant: InvestmentReportShareGrant = { id: "investment-report-share-a", ownerId: "owner-a", reportId: report.id, credentialDigest: credential.digest, credentialVersion: "sha256.v1", policyVersion: "investment-report-sharing.v1", reportSchemaVersion: "investment-report.v1", exportTemplateVersion: "investment-report-pdf.v1", recipientLabel: "Private recipient", allowPdfDownload: true, createdAt: "2026-07-30T00:00:00Z", expiresAt: "2026-08-06T00:00:00Z", revokedAt: null, replacesShareId: null, replacedByShareId: null, ...overrides };
  const record = vi.fn().mockResolvedValue(undefined), repository: SharedAccessRepository = { findGrant: vi.fn().mockResolvedValue(grant), findReport: vi.fn().mockResolvedValue({ title: report.title, strategy: report.strategy, generatedAt: report.generatedAt, snapshot: report.snapshot }), record };
  return { credential, grant, report, repository, record };
}
describe("resolveSharedInvestmentReport", () => {
  it("grants an anonymous bearer access to exactly one immutable snapshot", async () => {
    const value = setup(), result = await resolveSharedInvestmentReport({ shareId: value.grant.id, secret: value.credential.secret, repository: value.repository, now: () => new Date("2026-07-31") });
    expect(result.view.snapshot).toBe(value.report.snapshot); expect(result.view.allowPdfDownload).toBe(true);
    expect(result.view).not.toHaveProperty("recipientLabel"); expect(value.repository.findReport).toHaveBeenCalledWith(value.grant.reportId);
  });
  it.each([
    ["expired", { expiresAt: "2026-07-30T00:00:00Z" }, "SHARE_EXPIRED"],
    ["revoked", { revokedAt: "2026-07-30T10:00:00Z" }, "SHARE_REVOKED"],
  ] as const)("fails closed when %s", async (_label, overrides, code) => {
    const value = setup(overrides);
    await expect(resolveSharedInvestmentReport({ shareId: value.grant.id, secret: value.credential.secret, repository: value.repository, now: () => new Date("2026-07-31") })).rejects.toMatchObject({ code });
    expect(value.repository.findReport).not.toHaveBeenCalled();
  });
  it("does not disclose unknown, modified, or cross-paired credentials", async () => {
    const value = setup();
    await expect(resolveSharedInvestmentReport({ shareId: value.grant.id, secret: `${value.credential.secret.slice(0, -1)}x`, repository: value.repository })).rejects.toMatchObject({ code: "SHARE_CREDENTIAL_INVALID" });
    const unknown = { ...value.repository, findGrant: vi.fn().mockResolvedValue(null) };
    await expect(resolveSharedInvestmentReport({ shareId: "investment-report-share-unknown", secret: value.credential.secret, repository: unknown })).rejects.toMatchObject({ code: "SHARE_CREDENTIAL_INVALID" });
  });
  it("rechecks PDF permission and grant status", async () => {
    const value = setup({ allowPdfDownload: false });
    await expect(resolveSharedInvestmentReport({ shareId: value.grant.id, secret: value.credential.secret, repository: value.repository, forPdf: true })).rejects.toMatchObject({ code: "SHARE_PDF_NOT_ALLOWED" });
  });
  it("fails within deadline for a never-settling credential or report dependency", async () => {
    const value = setup(), repository = { ...value.repository, findGrant: () => new Promise<never>(() => undefined) };
    await expect(resolveSharedInvestmentReport({ shareId: value.grant.id, secret: value.credential.secret, repository, deadlineMs: 10 })).rejects.toMatchObject({ code: "SHARED_REPORT_TEMPORARILY_UNAVAILABLE" });
  });
  it("permits a valid view when privacy-safe history persistence fails", async () => {
    const value = setup(); value.record.mockRejectedValue(new Error("history unavailable"));
    await expect(resolveSharedInvestmentReport({ shareId: value.grant.id, secret: value.credential.secret, repository: value.repository })).resolves.toBeDefined();
  });
});
