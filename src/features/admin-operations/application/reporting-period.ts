export type ReportingPeriod = Readonly<{ from:string; to:string; label:string }>;
const defaults = { sync: 30, health: 7, audit: 30, support: 90 } as const;

export function resolveReportingPeriod(kind: keyof typeof defaults, query: Readonly<Record<string,string|string[]|undefined>>, now = new Date()): ReportingPeriod {
  const toCandidate = typeof query.to === "string" ? new Date(`${query.to}T23:59:59.999Z`) : now;
  const to = Number.isFinite(toCandidate.getTime()) ? toCandidate : now;
  const fallback = new Date(to.getTime() - defaults[kind] * 86_400_000);
  const fromCandidate = typeof query.from === "string" ? new Date(`${query.from}T00:00:00.000Z`) : fallback;
  const from = Number.isFinite(fromCandidate.getTime()) && fromCandidate <= to ? fromCandidate : fallback;
  return Object.freeze({ from: from.toISOString(), to: to.toISOString(), label: `${from.toLocaleDateString("en-US")} – ${to.toLocaleDateString("en-US")}` });
}
