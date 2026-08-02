import type { ReactNode } from "react";

type AdminStatCardProps = {
  label: string;
  value: ReactNode;
  detail?: string;
};

export function AdminStatCard({ label, value, detail }: AdminStatCardProps) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-stone-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-950">{value}</p>
      {detail ? <p className="mt-2 text-xs text-stone-500">{detail}</p> : null}
    </div>
  );
}
