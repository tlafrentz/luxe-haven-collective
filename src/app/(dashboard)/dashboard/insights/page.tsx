import { InsightsDashboard } from "@/features/insights/components"
import { getInsights } from "@/features/insights/server/get-insights"

export const metadata = {
  title: "Luxe Insights | Luxe Haven Collective",
  description:
    "Revenue, occupancy, market benchmarks, and actionable recommendations for your Luxe Haven property.",
}

export default async function InsightsPage() {
  const data = await getInsights()

  return <InsightsDashboard data={data} />
}
