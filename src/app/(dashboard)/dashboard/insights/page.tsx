import { InsightsDashboard } from "@/features/insights/components"
import { luxeInsightsMockData } from "@/features/insights/mock-data"

export const metadata = {
  title: "Luxe Insights | Luxe Haven Collective",
  description:
    "Revenue, occupancy, market benchmarks, and actionable recommendations for your Luxe Haven property.",
}

export default function InsightsPage() {
  return <InsightsDashboard data={luxeInsightsMockData} />
}
