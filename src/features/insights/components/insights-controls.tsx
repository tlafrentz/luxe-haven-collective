"use client"

import type {
  DateRangeValue,
  InsightProperty,
} from "../types"

interface InsightsControlsProps {
  properties: InsightProperty[]
  selectedPropertyId: string
  dateRange: DateRangeValue
  onPropertyChange: (propertyId: string) => void
  onDateRangeChange: (range: DateRangeValue) => void
}

const dateRangeOptions: Array<{
  label: string
  value: DateRangeValue
}> = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "Last year", value: "1y" },
]

export function InsightsControls({
  properties,
  selectedPropertyId,
  dateRange,
  onPropertyChange,
  onDateRangeChange,
}: InsightsControlsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Property
        </span>

        <select
          value={selectedPropertyId}
          onChange={(event) =>
            onPropertyChange(event.target.value)
          }
          className="min-w-64 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-900 shadow-sm outline-none transition focus:border-stone-400"
        >
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Date range
        </span>

        <select
          value={dateRange}
          onChange={(event) =>
            onDateRangeChange(
              event.target.value as DateRangeValue,
            )
          }
          className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-900 shadow-sm outline-none transition focus:border-stone-400"
        >
          {dateRangeOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
