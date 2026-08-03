export const PROJECT_STATUSES = [
  "draft",
  "planned",
  "in_progress",
  "on_hold",
  "completed",
  "archived",
] as const;
export const PROJECT_PHASES = [
  "setup",
  "design",
  "selections",
  "procurement",
  "installation",
  "punch_list",
  "complete",
] as const;
export const ORDER_STATUSES = [
  "draft",
  "ready_to_order",
  "ordered",
  "partially_fulfilled",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
] as const;
export const INSTALLATION_STATUSES = [
  "pending",
  "ready",
  "installed",
  "damaged",
  "missing",
  "incorrect",
  "deferred",
  "not_required",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectPhase = (typeof PROJECT_PHASES)[number];
export type Budget = Readonly<{
  target: number;
  contingency: number;
  labor: number;
  delivery: number;
  installation: number;
  tax: number;
}>;
export function totalBudget(value: Partial<Budget>) {
  return [
    value.target,
    value.contingency,
    value.labor,
    value.delivery,
    value.installation,
    value.tax,
  ].reduce<number>((sum, item) => sum + (Number(item) || 0), 0);
}
export function canCompleteProject(input: {
  openPunchItems: number;
  exceptionAuthorized: boolean;
}) {
  return input.openPunchItems === 0 || input.exceptionAuthorized;
}
export function snapshotPackage<T>(value: T): T {
  return structuredClone(value);
}
export function projectProgress(phase: ProjectPhase) {
  return (
    {
      setup: 5,
      design: 20,
      selections: 40,
      procurement: 65,
      installation: 85,
      punch_list: 95,
      complete: 100,
    } as const
  )[phase];
}
export function sanitizeAffiliateUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()])
      if (/^(utm_|ref$|tag$|aff|affiliate|click)/i.test(key))
        url.searchParams.delete(key);
    return url.toString();
  } catch {
    return null;
  }
}
