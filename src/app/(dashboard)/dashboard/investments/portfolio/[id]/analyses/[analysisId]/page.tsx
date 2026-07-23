import { notFound } from "next/navigation";
import { getInvestmentOpportunityRequestContext } from "@/app/actions/investment-opportunity-runtime";
import { buildOpportunityAnalysisDetailView } from "@/features/investment-opportunity";
import { OpportunityAnalysisDetail } from "@/features/investment-opportunity/components";

export default async function HistoricalOpportunityAnalysisPage({ params }: { params: Promise<{ id: string; analysisId: string }> }) { const { id, analysisId } = await params, context = await getInvestmentOpportunityRequestContext(); if (!context.ok) notFound(); const view = await buildOpportunityAnalysisDetailView(context.repository, { ownerId: context.ownerId, opportunityId: id, analysisId }); if (!view) notFound(); return <OpportunityAnalysisDetail view={view} />; }
