import type { PerformanceDataPoint } from "../types"

interface PerformanceChartProps {
  data: PerformanceDataPoint[]
}

function buildLinePath(values: number[], width: number, height: number) {
  if (values.length === 0) {
    return ""
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const horizontalStep = width / Math.max(values.length - 1, 1)

  return values
    .map((value, index) => {
      const x = index * horizontalStep
      const normalizedValue = (value - min) / range
      const y = height - normalizedValue * height

      return `${index === 0 ? "M" : "L"} ${x} ${y}`
    })
    .join(" ")
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  const chartWidth = 700
  const chartHeight = 220
  const revenuePath = buildLinePath(
    data.map((point) => point.revenue),
    chartWidth,
    chartHeight,
  )

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-stone-500">
            Revenue performance
          </p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">
            Six-month revenue trend
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
          <span className="h-2.5 w-2.5 rounded-full bg-stone-950" />
          Gross booking revenue
        </div>
      </div>

      <div className="mt-8 overflow-x-auto">
        <div className="min-w-[650px]">
          <svg
            viewBox={`-10 -20 ${chartWidth + 20} ${chartHeight + 55}`}
            className="h-72 w-full overflow-visible"
            role="img"
            aria-label="Revenue increased steadily over the previous six months"
          >
            {[0, 1, 2, 3, 4].map((line) => {
              const y = (chartHeight / 4) * line

              return (
                <line
                  key={line}
                  x1="0"
                  x2={chartWidth}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  className="text-stone-100"
                  strokeWidth="1"
                />
              )
            })}

            <path
              d={revenuePath}
              fill="none"
              stroke="currentColor"
              className="text-stone-950"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {data.map((point, index) => {
              const x =
                index * (chartWidth / Math.max(data.length - 1, 1))
              const values = data.map((item) => item.revenue)
              const min = Math.min(...values)
              const max = Math.max(...values)
              const range = max - min || 1
              const y =
                chartHeight -
                ((point.revenue - min) / range) * chartHeight

              return (
                <g key={point.label}>
                  <circle
                    cx={x}
                    cy={y}
                    r="6"
                    fill="white"
                    stroke="currentColor"
                    className="text-stone-950"
                    strokeWidth="4"
                  />

                  <text
                    x={x}
                    y={chartHeight + 32}
                    textAnchor="middle"
                    className="fill-stone-500 text-[13px]"
                  >
                    {point.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </section>
  )
}
