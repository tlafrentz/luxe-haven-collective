import Link from "next/link";
import { transitionInvestmentReportAction } from "@/app/actions/investment-reports";
import { ReportSubmitButton } from "./report-actions";
import type { buildInvestmentReportView } from "../application/investment-report-view";

type Report = ReturnType<typeof buildInvestmentReportView>;
export function InvestmentReportLibrary({ reports, status, error }: { reports: readonly Report[]; status: "active" | "archived"; error?: string }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-700">Investment workspace</p>
        <h1 className="mt-3 font-serif text-4xl text-stone-950">Saved Reports</h1>
        <p className="mt-3 max-w-2xl text-stone-600">Durable decision records generated from completed, saved investment analyses.</p>
      </header>
      {error ? (
        <div role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          Reports are temporarily unavailable. Your saved analyses and existing reports are unchanged. Please retry.
        </div>
      ) : null}
      <nav aria-label="Report status" className="mt-8 flex gap-2">
        <Tab active={status === "active"} href="/dashboard/reports">
          Active reports
        </Tab>
        <Tab active={status === "archived"} href="/dashboard/reports?archived=true">
          Archived reports
        </Tab>
      </nav>
      {reports.length ? (
        <div className="mt-6 grid gap-4">
          {reports.map((report) => (
            <article key={report.id} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    <span>{report.strategy === "purchase" ? "Purchase" : "Rental Arbitrage"}</span>
                    <span>·</span>
                    <span>Analysis {report.snapshot.lineage.analysisVersion}</span>
                    <span>·</span>
                    <span>{report.status}</span>
                  </div>
                  <h2 className="mt-2 font-serif text-2xl">
                    <Link href={`/dashboard/reports/${report.id}`} className="hover:underline">
                      {report.title}
                    </Link>
                  </h2>
                  <p className="mt-2 text-sm text-stone-600">{report.snapshot.subject.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold">{label(report.recommendation)}</p>
                  <p className="mt-1 text-sm text-stone-500">
                    {report.score}/{report.scoreMaximum} · {label(report.confidence)} confidence
                  </p>
                  <p className="mt-1 text-xs text-stone-500">{report.completeness === "complete" ? "Complete evidence record" : `${report.snapshot.limitations.length} recorded limitations`}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3 border-t pt-4">
                <Link href={`/dashboard/reports/${report.id}`} className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
                  Open report
                </Link>
                <Link href={`/dashboard/investments/opportunities/${report.opportunityId}`} className="rounded-full border px-4 py-2 text-sm font-semibold">
                  Open source opportunity
                </Link>
                <form action={transitionInvestmentReportAction}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="operation" value={status === "archived" ? "restore" : "archive"} />
                  <ReportSubmitButton label={status === "archived" ? "Restore" : "Archive"} pendingLabel={status === "archived" ? "Restoring…" : "Archiving…"} className="rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-60" />
                </form>
                <span className="ml-auto self-center text-xs text-stone-500">Generated {date(report.generatedAt)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
          <h2 className="font-serif text-2xl">No {status} reports</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-stone-600">{status === "active" ? "Complete and save an investment analysis, then generate its decision report here." : "Reports you archive will remain intact and appear here for restoration."}</p>
          {status === "active" ? (
            <Link href="/dashboard/investments" className="mt-5 inline-flex rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white">
              Analyze an investment
            </Link>
          ) : null}
        </div>
      )}
    </main>
  );
}
function Tab({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link aria-current={active ? "page" : undefined} href={href} className={`rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-stone-950 text-white" : "border bg-white text-stone-700"}`}>
      {children}
    </Link>
  );
}
function label(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function date(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}
