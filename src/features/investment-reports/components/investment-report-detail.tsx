import Link from "next/link";
import { Card } from "@/components/ui/card";
import { transitionInvestmentReportAction } from "@/app/actions/investment-reports";
import { ReportSubmitButton } from "./report-actions";
import { DownloadInvestmentReportPdf } from "@/features/investment-report-export/components";
import type { buildInvestmentReportView } from "../application/investment-report-view";

type View = ReturnType<typeof buildInvestmentReportView>;
const unavailable = "Unavailable";

export function InvestmentReportDetail({ report }: { report: View }) {
  const s = report.snapshot,
    f = s.financials,
    purchase = report.strategy === "purchase";
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/dashboard/reports" className="text-sm font-semibold text-stone-600 hover:text-stone-950">
        ← Saved Reports
      </Link>
      <header className="mt-6 rounded-3xl bg-stone-950 p-6 text-white sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">Investment decision report</p>
            <h1 className="mt-3 font-serif text-3xl sm:text-4xl">{report.title}</h1>
            <p className="mt-3 text-stone-300">{s.subject.address}</p>
          </div>
          <Status value={report.status} />
        </div>
        <dl className="mt-8 grid gap-4 border-t border-white/15 pt-6 sm:grid-cols-3 lg:grid-cols-6">
          <Fact label="Strategy" value={label(report.strategy)} />
          <Fact label="Analysis version" value={String(s.lineage.analysisVersion)} />
          <Fact label="Generated" value={date(s.generatedAt)} />
          <Fact label="Confidence" value={label(report.confidence)} />
          <Fact label="Completeness" value={report.completeness === "complete" ? "Complete" : `${s.limitations.length} limitations`} />
          <Fact label="Currency" value={s.currency} />
        </dl>
      </header>
      {report.status === "archived" ? (
        <div role="status" className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          This report is archived. Its immutable contents remain available.
        </div>
      ) : null}
      <section aria-labelledby="decision-summary" className="mt-7 grid gap-5 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 id="decision-summary" className="font-serif text-2xl">
            Executive decision summary
          </h2>
          <p className="mt-5 text-2xl font-semibold">{label(report.recommendation)}</p>
          <p className="mt-3 leading-7 text-stone-700">{report.recommendationSummary}</p>
          <h3 className="mt-6 font-semibold">Primary rationale</h3>
          <ul className="mt-2 space-y-2 text-sm text-stone-700">
            {s.decision.rationale.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
          <h3 className="mt-6 font-semibold">Decision readiness</h3>
          <p className="mt-2 text-sm text-stone-700">{report.decisionReadiness}</p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Investment score</p>
          <p className="mt-3 font-serif text-5xl">
            {report.score}
            <span className="text-xl text-stone-400">/{report.scoreMaximum}</span>
          </p>
          <p className="mt-5 text-sm text-stone-600">{s.confidence.explanation ?? `${label(report.confidence)} confidence based on saved evidence.`}</p>
        </Card>
      </section>
      <Section title="Property and opportunity summary">
        <Grid>
          <Fact label="Address" value={s.subject.address || unavailable} />
          <Fact label="Property type" value={s.subject.propertyType ?? unavailable} />
          <Fact label="Bedrooms" value={optional(s.subject.bedrooms)} />
          <Fact label="Bathrooms" value={optional(s.subject.bathrooms)} />
          <Fact label="Market" value={s.subject.market ?? unavailable} />
          <Fact label="Strategy" value={label(report.strategy)} />
        </Grid>
      </Section>
      <Section title="Revenue outlook">
        <Grid>
          <Money label="Average daily rate" value={f.projectedAdr} />
          <Percent label="Occupancy" value={f.projectedOccupancy?.value} />
          <Money label="Annual gross revenue" value={f.projectedAnnualRevenue} />
        </Grid>
      </Section>
      <Section title="Operating expense outlook">
        <Grid>
          <Money label="Annual operating expenses" value={f.operatingExpenses} />
          <Money label="Net operating income" value={f.netOperatingIncome} />
        </Grid>
        <p className="mt-5 text-sm text-stone-500">Itemized modeled expenses are preserved in the assumption ledger below. Acquisition costs and debt service are shown separately when present.</p>
      </Section>
      <Section title={purchase ? "Purchase financial performance" : "Rental-arbitrage financial performance"}>
        <Grid>
          {purchase ? (
            <>
              <Money label="Purchase price" value={f.purchasePrice} />
              <Money label="Initial cash invested" value={f.initialCashRequired} />
              <Percent label="Cap rate" value={f.capRate?.value} />
              <Percent label="Cash-on-cash return" value={f.cashOnCashReturn?.value} />
            </>
          ) : (
            <>
              <Money label="Monthly rent" value={f.proposedMonthlyLease} />
              <Money label="Initial cash invested" value={f.initialCashRequired} />
              <Percent label="ROI on invested capital" value={f.cashOnCashReturn?.value} />
            </>
          )}
          <Money label="Annual cash flow" value={f.annualCashFlow} />
          <Money label="Net operating income" value={f.netOperatingIncome} />
        </Grid>
      </Section>
      <Section title="Evidence and data provenance">
        <div className="grid gap-4 md:grid-cols-2">
          {s.evidence.length ? (
            s.evidence.map((item) => (
              <article key={item.id} className="rounded-2xl bg-stone-50 p-4">
                <p className="font-semibold">{item.title}</p>
                <p className="mt-2 text-sm text-stone-600">
                  Source: {item.source} · Confidence: {label(item.confidence)}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Observed: {item.providerTimestamp ? date(item.providerTimestamp) : unavailable}
                  {item.freshness ? ` · ${label(item.freshness)}` : ""}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-stone-600">No external evidence was available in the saved analysis.</p>
          )}
        </div>
      </Section>
      <Section title="Risks and limitations">
        <div className="grid gap-4 md:grid-cols-2">
          {s.risks.map((item) => (
            <article key={item.id} className="rounded-2xl border p-4">
              <p className="font-semibold">{item.title}</p>
              <p className="mt-2 text-sm text-stone-600">{item.description}</p>
              <p className="mt-2 text-xs font-semibold">Severity: {label(item.severity)}</p>
            </article>
          ))}
        </div>
        <ul className="mt-5 space-y-2 text-sm text-amber-900">{s.limitations.length ? s.limitations.map((item) => <li key={item.code}>• {item.description}</li>) : <li>No material data limitations were recorded.</li>}</ul>
      </Section>
      <Section title="Assumption ledger">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-stone-500">
                <th className="py-3">Assumption</th>
                <th>Value</th>
                <th>Unit</th>
                <th>Source</th>
                <th>Effective / observed</th>
              </tr>
            </thead>
            <tbody>
              {s.assumptions.map((item, index) => (
                <tr className="border-b" key={`${item.label}:${index}`}>
                  <th className="py-3 font-medium">{label(item.label)}</th>
                  <td>{display(item.value)}</td>
                  <td>{item.unit ? label(item.unit) : unavailable}</td>
                  <td>{label(item.sourceType)}</td>
                  <td>{item.observedAt ? date(item.observedAt) : unavailable}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!s.assumptions.length ? <p className="py-5 text-sm text-stone-600">No material assumptions were preserved in this analysis version.</p> : null}
        </div>
      </Section>
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
        <div className="text-xs text-stone-500">
          <p>Report schema: {s.schemaVersion}</p>
          <p>
            Analysis: {s.lineage.analysisId} · Projection: {s.analysisProjectionVersion}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <DownloadInvestmentReportPdf reportId={report.id} />
          <Link href={`/dashboard/investments/opportunities/${report.opportunityId}/analyses/${report.analysisId}`} className="rounded-full border px-5 py-2.5 text-sm font-semibold">
            Open source analysis
          </Link>
          <form action={transitionInvestmentReportAction}>
            <input type="hidden" name="reportId" value={report.id} />
            <input type="hidden" name="operation" value={report.status === "archived" ? "restore" : "archive"} />
            <ReportSubmitButton label={report.status === "archived" ? "Restore report" : "Archive report"} pendingLabel={report.status === "archived" ? "Restoring…" : "Archiving…"} className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" />
          </form>
        </div>
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-6 p-6 sm:p-7">
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="mt-5">{children}</div>
    </Card>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{children}</dl>;
}
function Fact({ label: name, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">{name}</dt>
      <dd className="mt-2 font-semibold text-stone-900">{value}</dd>
    </div>
  );
}
function Money({ label: name, value }: { label: string; value?: { amount: number; currency: string } }) {
  return (
    <Fact
      label={name}
      value={
        value
          ? new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: value.currency,
              maximumFractionDigits: 0,
            }).format(value.amount)
          : unavailable
      }
    />
  );
}
function Percent({ label: name, value }: { label: string; value?: number }) {
  return <Fact label={name} value={value === undefined || value === null ? unavailable : `${value <= 1 ? (value * 100).toFixed(1) : value.toFixed(1)}%`} />;
}
function Status({ value }: { value: string }) {
  return (
    <span role="status" className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide">
      {label(value)}
    </span>
  );
}
function label(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
function optional(value: number | null) {
  return value === null ? unavailable : String(value);
}
function display(value: string | number | boolean | null) {
  return value === null || value === "" ? unavailable : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
}
function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? unavailable
    : new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(parsed);
}
