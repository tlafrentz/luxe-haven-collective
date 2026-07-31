import { notFound } from "next/navigation";
import { getInvestmentOpportunityRequestContext } from "@/app/actions/investment-opportunity-runtime";
import { buildOpportunityAnalysisDetailView } from "@/features/investment-opportunity";
import { OpportunityAnalysisDetail } from "@/features/investment-opportunity/components";
import { findInvestmentReportForAnalysis, generateInvestmentReportAction } from "@/app/actions/investment-reports";

export default async function HistoricalOpportunityAnalysisPage({ params }: { params: Promise<{ id: string; analysisId: string }> }) { const { id, analysisId } = await params, context = await getInvestmentOpportunityRequestContext(); if (!context.ok||!await context.authorizeOpportunity(id,"analysis.read",analysisId)) notFound(); const [view, reportId] = await Promise.all([buildOpportunityAnalysisDetailView(context.repository, { ownerId: context.ownerId, opportunityId: id, analysisId }), findInvestmentReportForAnalysis(id, analysisId)]); if (!view) notFound(); return <OpportunityAnalysisDetail view={view} reportId={reportId} generateReportAction={generateInvestmentReportAction} />; }
