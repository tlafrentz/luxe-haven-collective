export type OwnerSelectionProjection = Readonly<{
  roomName: string;
  productName: string;
  retailerName: string | null;
  quantity: number;
  unitPriceMinor: number;
  deliveryMinor: number;
  status: string;
}>;

export function boundedSelectionQuantity(
  requested: number,
  rule: Readonly<{
    kind: "fixed_one" | "bounded";
    minimum: number;
    maximum: number;
  }>,
) {
  if (!Number.isFinite(requested) || !Number.isInteger(requested))
    throw new Error("SELECTION_QUANTITY_INVALID");
  if (rule.kind === "fixed_one" && requested !== 1)
    throw new Error("SELECTION_QUANTITY_FIXED_ONE");
  if (requested < rule.minimum || requested > rule.maximum)
    throw new Error("SELECTION_QUANTITY_OUT_OF_BOUNDS");
  return requested;
}

export function ownerPlanProjection(
  input: Readonly<{
    status: string;
    currency: string;
    selections: readonly OwnerSelectionProjection[];
  }>,
) {
  const selections = input.selections.map((selection) => ({ ...selection }));
  return {
    status: input.status,
    currency: input.currency,
    selections,
    subtotalMinor: selections.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceMinor,
      0,
    ),
    deliveryMinor: selections.reduce(
      (sum, item) => sum + item.deliveryMinor,
      0,
    ),
  };
}
