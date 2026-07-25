import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "dark" | "info";
const tones: Record<BadgeTone, string> = { neutral: "bg-stone-100 text-stone-700", success: "bg-emerald-50 text-emerald-800", warning: "bg-amber-50 text-amber-800", danger: "bg-rose-50 text-rose-800", dark: "bg-stone-900 text-white", info: "bg-blue-50 text-blue-800" };
export function Badge({ children, tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & Readonly<{ children: ReactNode; tone?: BadgeTone }>) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)} {...props}>{children}</span>;
}
