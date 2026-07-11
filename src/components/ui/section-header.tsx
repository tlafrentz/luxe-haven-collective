import type { ReactNode } from "react"

interface SectionHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-sm font-medium text-stone-500">
            {eyebrow}
          </p>
        ) : null}

        <h2 className="mt-1 text-xl font-semibold text-stone-950">
          {title}
        </h2>

        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            {description}
          </p>
        ) : null}
      </div>

      {action}
    </div>
  )
}
