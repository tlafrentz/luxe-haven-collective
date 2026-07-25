import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("rounded-2xl border border-stone-200 bg-white shadow-sm", className)} {...props} />; }
export function CardHeader({ title, description, accessory, className }: Readonly<{ title: string; description?: string; accessory?: ReactNode; className?: string }>) { return <div className={cn("flex items-start justify-between gap-4 p-5", className)}><div><h3 className="text-base font-semibold text-stone-950">{title}</h3>{description ? <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p> : null}</div>{accessory}</div>; }
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("px-5 pb-5", className)} {...props} />; }
export function CardActions({ children, className }: Readonly<{ children: ReactNode; className?: string }>) { return <div className={cn("flex flex-wrap items-center gap-2 border-t border-stone-100 px-5 py-4", className)}>{children}</div>; }
