"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & Readonly<{ label: string; helpText?: string; error?: string; prefix?: ReactNode; suffix?: ReactNode }>;
export function TextField({ label, helpText, error, prefix, suffix, id, className, required, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  return <label htmlFor={inputId} className="block"><span className="text-sm font-semibold text-stone-800">{label}{required ? <span aria-hidden="true" className="ml-1 text-rose-700">*</span> : null}</span><span className={cn("mt-2 flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 focus-within:ring-2 focus-within:ring-teal-600", error ? "border-rose-500" : "border-stone-300")}>{prefix}<input id={inputId} required={required} aria-invalid={error ? true : undefined} aria-describedby={helpText || error ? descriptionId : undefined} className={cn("min-w-0 flex-1 bg-transparent text-sm text-stone-950 outline-none placeholder:text-stone-400", className)} {...props} />{suffix}</span>{error || helpText ? <span id={descriptionId} className={cn("mt-1.5 block text-xs leading-5", error ? "text-rose-700" : "text-stone-500")}>{error ?? helpText}</span> : null}</label>;
}
