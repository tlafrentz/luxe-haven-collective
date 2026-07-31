"use client";
import { useFormStatus } from "react-dom";

export function ReportSubmitButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={className ?? "rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"}>{pending ? pendingLabel : label}</button>;
}
