import {
  InvestmentWorkspace,
} from "@/features/investment-intelligence";
import { SaveOpportunityPanel } from "@/features/investment-opportunity/components";
import { hydrateReanalysis, readImmutableAnalysis } from "@/features/investment-opportunity";
import { getInvestmentOpportunityRequestContext } from "@/app/actions/investment-opportunity-runtime";
import Link from "next/link";
import { AcquisitionType } from "@/features/investment-intelligence";

export default async function NewInvestmentAnalysisPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams, opportunityId = single(params.opportunity), sourceVersionId=single(params.analysis), reanalyzing = single(params.mode) === "reanalyze" && opportunityId;
  const context = reanalyzing ? await getInvestmentOpportunityRequestContext() : null;
  const authorized=context?.ok&&opportunityId?await context.authorizeOpportunity(opportunityId,"analysis.reanalyze",sourceVersionId):false;
  const projection=authorized&&context?.ok&&opportunityId?await readImmutableAnalysis(context.repository,{ownerId:context.ownerId,opportunityId,...(sourceVersionId?{analysisVersionId:sourceVersionId}:{})}):null;
  const bootstrap=projection&&context?.ok?hydrateReanalysis(projection,{workspaceId:context.workspaceId}):null;
  const strategy = single(params.strategy), routeInitialValues = strategy === AcquisitionType.RentalArbitrage || strategy === AcquisitionType.Purchase ? { acquisitionType: strategy } : undefined;
  return <InvestmentWorkspace initialValues={bootstrap?.workspaceValues??routeInitialValues} contextNotice={bootstrap ? <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-blue-950">Reanalyzing: {projection!.opportunity.property.displayAddress}</p><p className="mt-1 text-sm text-blue-800">Source: Analysis {bootstrap.source.sourceVersionNumber} · Saved {new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(bootstrap.source.sourceCreatedAt))}</p><p className="mt-2 text-xs text-blue-700">Persisted assumptions were restored from this exact version. New provider evidence and defaults remain alternatives until explicitly accepted.</p></div><Link href={`/dashboard/investments/opportunities/${bootstrap.source.opportunityId}`} className="text-sm font-semibold text-blue-900 underline">Cancel Reanalysis</Link></div></section> : undefined} resultsActions={<SaveOpportunityPanel />} />;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
