import { generateReportAction } from "@/app/actions/reporting";

export default function NewReportPage() {
  return <main className="mx-auto max-w-3xl space-y-8 px-5 py-10"><header><p className="eyebrow">Reports</p><h1 className="mt-2 text-4xl font-semibold">Create report</h1><p className="mt-3 text-stone-600">Final generation resolves permissions and entitlements before creating an immutable snapshot.</p></header>
    <form action={generateReportAction} className="space-y-5 rounded-3xl border p-6 sm:p-8">
      <Field label="Workspace ID"><input className="mt-2 w-full rounded-xl border p-3" name="workspaceId" required /></Field>
      <Field label="Report type"><select className="mt-2 w-full rounded-xl border p-3" name="reportType"><option value="investment-decision">Investment Decision</option><option value="property-performance">Property Performance</option><option value="portfolio-performance">Portfolio Performance</option><option value="financial-performance">Financial Performance</option></select></Field>
      <Field label="Source ID"><input className="mt-2 w-full rounded-xl border p-3" name="sourceId" placeholder="Opportunity or Property ID where required" /></Field>
      <Field label="Investment Scenario ID"><input className="mt-2 w-full rounded-xl border p-3" name="scenarioId" placeholder="Required for Investment Decision Reports" /></Field>
      <Field label="Report title"><input className="mt-2 w-full rounded-xl border p-3" maxLength={160} name="title" placeholder="Optional display title" /></Field>
      <Field label="Reporting period"><select className="mt-2 w-full rounded-xl border p-3" name="periodPreset"><option value="current-month">Current month</option><option value="year-to-date">Year to date</option><option value="trailing-12-months">Trailing 12 months</option></select></Field>
      <input name="idempotencyKey" type="hidden" value={crypto.randomUUID()} />
      <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Property Performance generation remains unavailable until its canonical Property report projection port is connected. No raw Property tables will be used as a fallback.</div>
      <button className="rounded-full bg-stone-950 px-6 py-3 font-semibold text-white" type="submit">Generate immutable report</button>
    </form>
  </main>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block text-sm font-semibold">{label}{children}</label>;}
