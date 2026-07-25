import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function IconButton({ label, children, className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & Readonly<{ label: string; children: ReactNode }>) {
  return <button type={type} aria-label={label} title={label} className={cn("inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 outline-none transition-colors motion-reduce:transition-none hover:bg-stone-50 hover:text-stone-950 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45", className)} {...props}>{children}</button>;
}
