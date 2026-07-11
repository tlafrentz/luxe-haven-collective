import { Card } from "@/components/ui/card"
import { SectionHeader } from "@/components/ui/section-header"
import type { OccupancyDay } from "../types"

interface OccupancyHeatmapProps {
  data: OccupancyDay[]
}

function getOccupancyClasses(occupancy: number) {
  if (occupancy >= 90) {
    return "bg-stone-950 text-white"
  }

  if (occupancy >= 80) {
    return "bg-stone-800 text-white"
  }

  if (occupancy >= 70) {
    return "bg-stone-600 text-white"
  }

  if (occupancy >= 60) {
    return "bg-stone-300 text-stone-950"
  }

  return "bg-stone-100 text-stone-700"
}

export function OccupancyHeatmap({
  data,
}: OccupancyHeatmapProps) {
  return (
    <Card className="p-5 sm:p-6">
      <SectionHeader
        eyebrow="Booking patterns"
        title="Occupancy by day"
        description="Identify strong booking periods and midweek opportunities."
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
        {data.map((item) => (
          <div
            key={item.day}
            className={[
              "rounded-xl p-4",
              getOccupancyClasses(item.occupancy),
            ].join(" ")}
          >
            <p className="text-xs font-medium opacity-75">
              {item.day}
            </p>

            <p className="mt-2 text-2xl font-semibold">
              {item.occupancy}%
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}
