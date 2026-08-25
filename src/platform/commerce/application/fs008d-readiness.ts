export type Fs008dBudgetOutcome = "below_completeness_floor" | "within_target" | "above_target" | "exception_required" | "above_ceiling" | "indeterminate";
export type Fs008dReadiness = Readonly<{ ready: boolean; budgetOutcome: Fs008dBudgetOutcome; totalMinor?: number; reasons: readonly string[] }>;
export function evaluateFs008dReadiness(input: Readonly<{ requiredRooms: readonly string[]; presentRooms: readonly string[]; requiredItems: readonly { productId?: string; offerAvailable: boolean; quantity: number; durable: boolean }[]; diningSeats: number; workspaceFunctional: boolean; tvMountCompatible: boolean; deliveryMinor?: number; targetMinor?: number }>): Fs008dReadiness {
  const reasons: string[] = [];
  for (const room of input.requiredRooms) if (!input.presentRooms.includes(room)) reasons.push(`missing_room:${room}`);
  if (input.diningSeats < 6) reasons.push("dining_capacity_below_six");
  if (!input.workspaceFunctional) reasons.push("workspace_incomplete");
  if (!input.tvMountCompatible) reasons.push("tv_mount_incompatible");
  for (const item of input.requiredItems) { if (!item.productId) reasons.push("required_product_missing"); if (!item.offerAvailable) reasons.push("required_offer_unavailable"); if (item.quantity <= 0) reasons.push("invalid_quantity"); }
  const totalMinor = (input.targetMinor ?? 0) + (input.deliveryMinor ?? 0);
  const budgetOutcome: Fs008dBudgetOutcome = reasons.length ? "indeterminate" : totalMinor < 1_100_000 ? "below_completeness_floor" : totalMinor <= 1_400_000 ? "within_target" : totalMinor <= 1_550_000 ? "exception_required" : "above_ceiling";
  return { ready: reasons.length === 0 && budgetOutcome !== "above_ceiling" && budgetOutcome !== "indeterminate", budgetOutcome, totalMinor, reasons };
}
