import type { ReactNode } from "react";

type AdminStatCardProps = {
  label: string;
  value: ReactNode;
  detail?: string;
};

export function AdminStatCard({ label, value, detail }: AdminStatCardProps) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
      <p className="text-sm text-white/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-2 text-xs text-white/40">{detail}</p> : null}
    </div>
  );
}
