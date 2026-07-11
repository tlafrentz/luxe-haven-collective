import type { LuxeInsightsData } from "./types"

export const luxeInsightsMockData: LuxeInsightsData = {
  property: {
    id: "mesa-downtown-retreat",
    name: "Mesa Downtown Retreat",
    location: "Mesa, Arizona",
  },
  periodLabel: "Last 30 days",
  metrics: [
    {
      id: "revenue",
      label: "Revenue",
      value: 4832,
      format: "currency",
      change: 18.2,
      trend: "up",
      comparisonLabel: "vs. previous 30 days",
    },
    {
      id: "occupancy",
      label: "Occupancy",
      value: 82,
      format: "percentage",
      change: 7.1,
      trend: "up",
      comparisonLabel: "vs. previous 30 days",
    },
    {
      id: "adr",
      label: "Average daily rate",
      value: 178,
      format: "currency",
      change: 4.8,
      trend: "up",
      comparisonLabel: "vs. previous 30 days",
    },
    {
      id: "revpar",
      label: "RevPAR",
      value: 146,
      format: "currency",
      change: 12.4,
      trend: "up",
      comparisonLabel: "vs. previous 30 days",
    },
    {
      id: "review-score",
      label: "Review score",
      value: 4.96,
      format: "rating",
      change: 0.1,
      trend: "up",
      comparisonLabel: "across recent stays",
    },
    {
      id: "response-rate",
      label: "Response rate",
      value: 100,
      format: "percentage",
      change: 0,
      trend: "neutral",
      comparisonLabel: "maintained this period",
    },
  ],
  performance: [
    { label: "Jan", revenue: 3180, occupancy: 68 },
    { label: "Feb", revenue: 3540, occupancy: 71 },
    { label: "Mar", revenue: 3890, occupancy: 74 },
    { label: "Apr", revenue: 4225, occupancy: 78 },
    { label: "May", revenue: 4510, occupancy: 80 },
    { label: "Jun", revenue: 4832, occupancy: 82 },
  ],
  marketComparisons: [
    {
      id: "market-adr",
      label: "Average daily rate",
      propertyValue: 178,
      marketValue: 164,
      format: "currency",
    },
    {
      id: "market-occupancy",
      label: "Occupancy",
      propertyValue: 82,
      marketValue: 76,
      format: "percentage",
    },
    {
      id: "market-revpar",
      label: "RevPAR",
      propertyValue: 146,
      marketValue: 125,
      format: "currency",
    },
  ],
  recommendations: [
    {
      id: "weekend-pricing",
      title: "Increase weekend pricing by 8%",
      description:
        "Your weekend occupancy remains strong while comparable homes are charging more for Friday and Saturday nights.",
      priority: "high",
      estimatedImpact: "+$240 to $360 monthly",
    },
    {
      id: "weekday-pricing",
      title: "Create a Tuesday and Wednesday pricing rule",
      description:
        "Midweek demand trails the local market. A targeted rate adjustment could improve occupancy without lowering weekend revenue.",
      priority: "medium",
      estimatedImpact: "+3 to 5 occupied nights",
    },
    {
      id: "listing-photos",
      title: "Add more exterior and arrival photos",
      description:
        "Your listing has fewer exterior images than similar high-performing properties, which may reduce guest confidence before booking.",
      priority: "medium",
      estimatedImpact: "Potential conversion lift",
    },
  ],
}
