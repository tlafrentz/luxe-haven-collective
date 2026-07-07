import { StatCard } from "@/components/portal/stat-card";

export default function OwnerDashboardPage() {
  return <section><p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">Owner Portal</p><h1 className="mt-3 font-serif text-5xl">Portfolio snapshot</h1><div className="mt-8 grid gap-5 md:grid-cols-4"><StatCard label="Monthly revenue" value="$4,820" helper="Mesa Downtown Retreat" /><StatCard label="Occupancy" value="87%" helper="Trailing 30 days" /><StatCard label="Upcoming stays" value="12" helper="Next 30 days" /><StatCard label="Open issues" value="2" helper="Maintenance queue" /></div><div className="mt-8 rounded-3xl border border-border bg-card p-6"><h2 className="text-xl font-semibold">Property performance</h2><div className="mt-5 rounded-2xl bg-muted/30 p-5"><p className="font-semibold">Mesa Downtown Retreat</p><p className="mt-2 text-sm text-muted-foreground">Occupancy 87% · Revenue $4,820 · ADR $168 · Reviews 4.92 ⭐</p></div></div></section>;
}
