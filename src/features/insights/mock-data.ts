import type { LuxeInsightsData } from "./types"

export const luxeInsightsMockData: LuxeInsightsData = {
  property: {
    id: "mesa-downtown-retreat",
    name: "Mesa Downtown Retreat",
    location: "Mesa, Arizona",
  },

  availableProperties: [
    {
      id: "mesa-downtown-retreat",
      name: "Mesa Downtown Retreat",
      location: "Mesa, Arizona",
    },
    {
      id: "scottsdale-desert-suite",
      name: "Scottsdale Desert Suite",
      location: "Scottsdale, Arizona",
    },
    {
      id: "tempe-modern-loft",
      name: "Tempe Modern Loft",
      location: "Tempe, Arizona",
    },
  ],

  periodLabel: "Last 30 days",
  lastUpdatedLabel: "Updated 12 minutes ago",

  performanceScore: {
    score: 92,
    label: "Excellent",
    percentile: 8,
    marketName: "Mesa market",
  },

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
    {
      label: "Jan",
      revenue: 3180,
      occupancy: 68,
      adr: 153,
      revpar: 104,
    },
    {
      label: "Feb",
      revenue: 3540,
      occupancy: 71,
      adr: 158,
      revpar: 112,
    },
    {
      label: "Mar",
      revenue: 3890,
      occupancy: 74,
      adr: 164,
      revpar: 121,
    },
    {
      label: "Apr",
      revenue: 4225,
      occupancy: 78,
      adr: 169,
      revpar: 132,
    },
    {
      label: "May",
      revenue: 4510,
      occupancy: 80,
      adr: 174,
      revpar: 139,
    },
    {
      label: "Jun",
      revenue: 4832,
      occupancy: 82,
      adr: 178,
      revpar: 146,
    },
    {
      label: "Jul",
      revenue: 5120,
      occupancy: 84,
      adr: 183,
      revpar: 154,
      forecast: true,
    },
    {
      label: "Aug",
      revenue: 5360,
      occupancy: 85,
      adr: 187,
      revpar: 159,
      forecast: true,
    },
  ],

  occupancyByDay: [
    { day: "Monday", occupancy: 68 },
    { day: "Tuesday", occupancy: 57 },
    { day: "Wednesday", occupancy: 63 },
    { day: "Thursday", occupancy: 76 },
    { day: "Friday", occupancy: 91 },
    { day: "Saturday", occupancy: 96 },
    { day: "Sunday", occupancy: 82 },
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
      category: "revenue",
      title: "Increase weekend pricing by 8%",
      description:
        "Weekend demand remains strong while comparable homes are charging more for Friday and Saturday nights.",
      priority: "high",
      estimatedImpact: "+$240 to $360 monthly",
      confidence: 92,
      effort: "5 minutes",
      actionLabel: "Review pricing rule",
    },
    {
      id: "weekday-pricing",
      category: "occupancy",
      title: "Create a Tuesday and Wednesday discount",
      description:
        "Midweek demand trails the local market. A targeted adjustment could improve occupancy without lowering weekend revenue.",
      priority: "medium",
      estimatedImpact: "+3 to 5 occupied nights",
      confidence: 86,
      effort: "10 minutes",
      actionLabel: "Create midweek rule",
    },
    {
      id: "listing-photos",
      category: "listing",
      title: "Add exterior and arrival photos",
      description:
        "Your listing has fewer exterior images than similar high-performing properties, which may reduce booking confidence.",
      priority: "medium",
      estimatedImpact: "Potential 3% to 6% conversion lift",
      confidence: 78,
      effort: "30 minutes",
      actionLabel: "Review listing photos",
    },
  ],
}
