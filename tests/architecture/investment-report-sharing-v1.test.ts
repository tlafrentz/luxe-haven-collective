import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const migration = readFileSync("supabase/migrations/20260730220000_investment_report_sharing_v1.sql", "utf8");
const publicPage = readFileSync("src/app/(public)/shared/investment-report/[shareId]/[secret]/page.tsx", "utf8");
const publicPdf = readFileSync("src/app/(public)/shared/investment-report/[shareId]/[secret]/pdf/route.ts", "utf8");
const resolver = readFileSync("src/features/investment-report-sharing/application/resolve-shared-investment-report.ts", "utf8");
const actions = readFileSync("src/app/actions/investment-report-sharing.ts", "utf8");
const runtime = readFileSync("src/app/actions/investment-report-sharing-runtime.ts", "utf8");
const config = readFileSync("next.config.ts", "utf8");
describe("Investment Report Sharing v1 boundaries", () => {
  it("uses forward-only owner-managed tables with no anonymous direct access", () => {
    expect(migration).toContain("create table public.investment_report_shares");
    expect(migration).toContain("enable row level security"); expect(migration).toContain("owner_profile_id=auth.uid()");
    expect(migration).toContain("revoke all on public.investment_report_shares,public.investment_report_share_access from anon");
    expect(migration).not.toMatch(/create policy[\s\S]*?to anon/);
  });
  it("stores only credential digests and enforces bounded active grants atomically", () => {
    expect(migration).toContain("credential_digest"); expect(migration).not.toMatch(/plaintext_secret|credential_secret|share_url/);
    expect(migration).toContain("if v_count>=10"); expect(migration).toContain("unique(owner_profile_id,idempotency_key)");
    expect(migration).toContain("replace_investment_report_share_v1"); expect(migration).not.toMatch(/delete from public\.investment_report/);
  });
  it("reads only generated report projection snapshots without calculators or providers", () => {
    expect(runtime).toContain('from("generated_reports")'); expect(runtime).toContain("projection_snapshot");
    expect(`${actions}${runtime}${resolver}${publicPage}`).not.toMatch(/readImmutableAnalysis|runInvestmentAnalysis|provider|market refresh|opportunity state/i);
  });
  it("applies non-indexing, no-referrer, and private no-store controls", () => {
    expect(config).toContain("private, no-store"); expect(config).toContain("noindex, nofollow, noarchive"); expect(config).toContain("no-referrer");
    expect(publicPage).not.toMatch(/openGraph|canonical|share\.secret|console/);
  });
  it("revalidates the credential and PDF permission for every shared download", () => {
    expect(publicPdf).toContain("resolveSharedInvestmentReport"); expect(publicPdf).toContain("forPdf: true"); expect(publicPdf).toContain("exportInvestmentReport");
    expect(publicPdf).not.toMatch(/createAdminClient|storage|publicUrl/);
  });
});
