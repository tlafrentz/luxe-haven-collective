import { notFound } from "next/navigation";
import { getInvestmentOpportunityRequestContext } from "@/app/actions/investment-opportunity-runtime";
import { createInvestmentOpportunityId, listOpportunityNotes, loadOpportunityDetail } from "@/features/investment-opportunity";
import { OpportunityDetail } from "@/features/investment-opportunity/components";

export default async function InvestmentOpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, context = await getInvestmentOpportunityRequestContext(); if (!context.ok) notFound();
  const opportunity = await loadOpportunityDetail(context.repository, context.ownerId, createInvestmentOpportunityId(id)); if (!opportunity) notFound();
  const notes = await listOpportunityNotes(context.noteRepository, id, context.ownerId);
  return <OpportunityDetail opportunity={opportunity} notes={notes} />;
}
