export function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return <div className="rounded-3xl border border-border bg-card p-6 shadow-sm"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p>{helper ? <p className="mt-2 text-sm text-muted-foreground">{helper}</p> : null}</div>;
}
