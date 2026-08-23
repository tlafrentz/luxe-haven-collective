import { redirect } from "next/navigation";
import { CatalogCard } from "@/features/reporting-suite";
import { getGenerationOptions } from "@/features/reporting-suite/application/reporting-workspace-composition";
type ReportRequestParams = Readonly<{ sourceCapability?: string; sourceView?: string; reportScope?: string; workspace?: string; scope?: string; from?: string; to?: string; compareFrom?: string; compareTo?: string; basis?: string }>;
export default async function NewReportPage({ searchParams }: { searchParams: Promise<ReportRequestParams> }) {
  const [options, params] = await Promise.all([getGenerationOptions(), searchParams]);
  if (!options) redirect("/login?next=/dashboard/reports/new");
  const source = capability(params.sourceCapability),
    view = params.sourceView?.replaceAll("-", " "),
    requestQuery = source
      ? new URLSearchParams({
          sourceCapability: params.sourceCapability!,
          ...(params.sourceView ? { sourceView: params.sourceView } : {}),
          ...(params.reportScope ? { reportScope: params.reportScope } : {}),
          ...(params.workspace ? { workspace: params.workspace } : {}),
          ...(params.scope ? { scope: params.scope } : {}),
          ...(params.from ? { from: params.from } : {}),
          ...(params.to ? { to: params.to } : {}),
          ...(params.compareFrom ? { compareFrom: params.compareFrom } : {}),
          ...(params.compareTo ? { compareTo: params.compareTo } : {}),
          ...(params.basis ? { basis: params.basis } : {}),
        }).toString()
      : "";
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
      <header>
        <h1 className="text-4xl font-semibold">Generate Report</h1>
        <p className="mt-2 text-stone-600">Choose the business question you want this immutable report to answer.</p>
      </header>
      {source ? (
        <section role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Requested from {source} Intelligence</p>
          <h2 className="mt-2 text-xl font-semibold">Create an authorized {source} Intelligence report</h2>
          <p className="mt-2 text-sm text-stone-700">{view ? `Requested view: ${view}. ` : ""}{params.reportScope === "full-capability" ? "Scope: full capability. " : "Scope: current view. "}Reports owns generation, status, artifacts, downloads, and history. Select an available definition below.</p>
        </section>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {options.definitions.map((item) => (
          <CatalogCard key={item.definition.definitionId} definition={item.definition} available={item.availability.state === "available"} reason={"reason" in item.availability ? item.availability.reason : undefined} configureHref={requestQuery ? `/dashboard/reports/new/${encodeURIComponent(item.definition.definitionId)}?${requestQuery}` : undefined} />
        ))}
      </div>
    </main>
  );
}
function capability(value?: string) {
  return value === "financial" ? "Financial" : value === "revenue" ? "Revenue" : value === "executive" ? "Executive" : value === "portfolio" ? "Portfolio" : value === "investment" ? "Investment" : null;
}
