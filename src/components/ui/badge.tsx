import type { ReactNode } from "react"

type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "dark"

interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-stone-100 text-stone-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
  dark: "bg-stone-900 text-white",
}

export function Badge({
  children,
  tone = "neutral",
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
      ].join(" ")}
    >
      {children}
    </span>
  )
}
