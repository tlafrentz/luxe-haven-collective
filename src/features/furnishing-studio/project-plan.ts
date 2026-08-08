export type PlanSelectionInput = Readonly<{
  id: string;
  roomId: string;
  required: boolean;
  productId: string | null;
  resolvedQuantity: number;
  existingQuantity: number;
  unitPriceMinor: number | null;
  selectionStatus: string;
  offerAvailability?: string | null;
  priceObservedAt?: string | null;
  styleCompatibility?: string | null;
}>;
export function purchaseQuantity(
  required: number,
  existing: number,
  override: number | null = null,
) {
  const target = override ?? required;
  if (
    !Number.isFinite(target) ||
    target < 0 ||
    !Number.isFinite(existing) ||
    existing < 0
  )
    throw new Error("PLAN_QUANTITY_INVALID");
  return Math.max(0, target - existing);
}
export function selectionEstimate(
  input: Pick<
    PlanSelectionInput,
    "resolvedQuantity" | "existingQuantity" | "unitPriceMinor"
  >,
  override: number | null = null,
) {
  const quantity = purchaseQuantity(
    input.resolvedQuantity,
    input.existingQuantity,
    override,
  );
  return input.unitPriceMinor === null
    ? null
    : Math.round(quantity * input.unitPriceMinor);
}
export function budgetStatus(estimatedMinor: number, targetMinor: number) {
  if (targetMinor < 0 || estimatedMinor < 0)
    throw new Error("PLAN_BUDGET_INVALID");
  if (estimatedMinor > targetMinor) return "over_budget" as const;
  if (targetMinor > 0 && estimatedMinor > targetMinor * 0.95)
    return "near_budget" as const;
  return "on_track" as const;
}
export function planProgress(
  selections: readonly PlanSelectionInput[],
  requiredCount: number,
) {
  const resolved = selections.filter(
    (x) =>
      x.required &&
      ["selected", "approved", "replaced", "existing_inventory"].includes(
        x.selectionStatus,
      ),
  ).length;
  return {
    resolved,
    requiredCount,
    percent: requiredCount ? Math.round((resolved / requiredCount) * 100) : 0,
  };
}
export function validatePlan(
  input: Readonly<{
    selections: readonly PlanSelectionInput[];
    requiredItemIds: readonly string[];
    roomIds: readonly string[];
    roomsWithPackages: readonly string[];
    targetBudgetMinor: number | null;
    staleAfterDays?: number;
    now?: Date;
  }>,
) {
  const errors: string[] = [],
    warnings: string[] = [],
    byId = new Map(input.selections.map((x) => [x.id, x]));
  for (const id of input.requiredItemIds) {
    const item = byId.get(id);
    if (!item?.productId && !item?.existingQuantity)
      errors.push(`Required item ${id} has no selection`);
    if (item && item.resolvedQuantity < 0)
      errors.push(`Required item ${id} has invalid quantity`);
  }
  for (const room of input.roomIds)
    if (!input.roomsWithPackages.includes(room))
      errors.push(`Room ${room} has no package`);
  let estimated = 0;
  for (const item of input.selections) {
    const total = selectionEstimate(item);
    if (total === null && item.productId)
      warnings.push(`Selection ${item.id} has no price`);
    else estimated += total ?? 0;
    if (item.offerAvailability === "out_of_stock")
      warnings.push(`Selection ${item.id} offer is out of stock`);
    if (item.styleCompatibility === null && item.productId)
      warnings.push(`Selection ${item.id} is unclassified for style`);
  }
  if (input.targetBudgetMinor !== null && estimated > input.targetBudgetMinor)
    warnings.push("Plan exceeds target budget");
  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    estimatedTotalMinor: estimated,
    ready: errors.length === 0,
  };
}
export function replaceSelection<
  T extends Readonly<{
    productId: string | null;
    offerId: string | null;
    unitPriceMinor: number | null;
    status: string;
  }>,
>(
  current: T,
  next: Readonly<{
    productId: string;
    offerId: string | null;
    unitPriceMinor: number | null;
  }>,
) {
  return {
    ...current,
    productId: next.productId,
    offerId: next.offerId,
    unitPriceMinor: next.unitPriceMinor,
    status: "replaced",
  };
}
