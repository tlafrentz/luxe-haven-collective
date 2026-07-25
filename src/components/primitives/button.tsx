"use client";

import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
export type ButtonSize = "small" | "medium" | "large";
const variants: Record<ButtonVariant, string> = { primary: "bg-stone-950 text-white hover:bg-stone-800", secondary: "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50", tertiary: "bg-transparent text-stone-700 hover:bg-stone-100", destructive: "bg-rose-700 text-white hover:bg-rose-800" };
const sizes: Record<ButtonSize, string> = { small: "min-h-9 px-3 text-xs", medium: "min-h-11 px-5 text-sm", large: "min-h-12 px-6 text-sm" };
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Readonly<{ variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; leadingIcon?: ReactNode; trailingIcon?: ReactNode }>;

export function Button({ variant = "primary", size = "medium", loading = false, leadingIcon, trailingIcon, children, className, disabled, type = "button", ...props }: ButtonProps) {
  return <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cn("inline-flex items-center justify-center gap-2 rounded-full font-semibold outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45", variants[variant], sizes[size], className)} {...props}>{loading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : leadingIcon}{children}{!loading ? trailingIcon : null}</button>;
}
