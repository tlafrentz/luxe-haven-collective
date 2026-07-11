import type { HTMLAttributes } from "react"

type CardProps = HTMLAttributes<HTMLDivElement>

export function Card({
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "rounded-2xl border border-stone-200 bg-white shadow-sm",
        className,
      ].join(" ")}
      {...props}
    />
  )
}
