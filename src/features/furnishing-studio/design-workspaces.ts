export const DESIGN_WORKSPACE_STATES = [
  "draft",
  "designing",
  "internal_review",
  "customer_review",
  "changes_requested",
  "approved",
  "archived",
] as const;
export type BudgetInclusionBasis =
  | "products_only"
  | "products_delivery"
  | "products_delivery_assembly"
  | "complete_installed"
  | "custom";

export function canTransitionDesignWorkspace(
  from: string,
  to: string,
  customerReviewRequired = true,
) {
  const allowed = new Set([
    "draft:designing",
    "designing:internal_review",
    "internal_review:changes_requested",
    ...(customerReviewRequired
      ? [
          "internal_review:customer_review",
          "customer_review:changes_requested",
          "customer_review:approved",
        ]
      : ["internal_review:approved"]),
    "changes_requested:designing",
    "approved:archived",
  ]);
  return allowed.has(`${from}:${to}`);
}

export type BudgetLine = Readonly<{
  quantity: number;
  unitPriceMinor: number;
  deliveryMinor?: number;
  taxMinor?: number;
  assemblyMinor?: number;
  installationMinor?: number;
  disposalMinor?: number;
  designFeeMinor?: number;
  discountMinor?: number;
  creditMinor?: number;
  currency: string;
}>;
export function calculateDesignBudget(
  lines: readonly BudgetLine[],
  contingencyBasisPoints = 0,
) {
  if (
    !Number.isSafeInteger(contingencyBasisPoints) ||
    contingencyBasisPoints < 0 ||
    contingencyBasisPoints > 10_000
  )
    throw new Error("DESIGN_BUDGET_CONTINGENCY_INVALID");
  const currencies = new Set(lines.map((line) => line.currency));
  if (currencies.size > 1) throw new Error("DESIGN_BUDGET_MIXED_CURRENCY");
  for (const line of lines)
    if (
      !Number.isSafeInteger(line.quantity) ||
      line.quantity <= 0 ||
      !Number.isSafeInteger(line.unitPriceMinor)
    )
      throw new Error("DESIGN_BUDGET_LINE_INVALID");
  const productSubtotalMinor = lines.reduce(
    (n, x) => n + x.unitPriceMinor * x.quantity,
    0,
  );
  const sum = (key: keyof BudgetLine) =>
    lines.reduce((n, x) => n + Number(x[key] ?? 0), 0);
  const deliveryMinor = sum("deliveryMinor"),
    taxMinor = sum("taxMinor"),
    assemblyMinor = sum("assemblyMinor"),
    installationMinor = sum("installationMinor"),
    disposalMinor = sum("disposalMinor"),
    designFeeMinor = sum("designFeeMinor"),
    discountsMinor = sum("discountMinor"),
    creditsMinor = sum("creditMinor");
  const base =
    productSubtotalMinor +
    deliveryMinor +
    taxMinor +
    assemblyMinor +
    installationMinor +
    disposalMinor +
    designFeeMinor;
  const contingencyMinor = Math.round((base * contingencyBasisPoints) / 10_000);
  return {
    productSubtotalMinor,
    deliveryMinor,
    taxMinor,
    assemblyMinor,
    installationMinor,
    disposalMinor,
    designFeeMinor,
    discountsMinor,
    creditsMinor,
    contingencyMinor,
    estimatedTotalMinor:
      base + contingencyMinor - discountsMinor - creditsMinor,
    currency: [...currencies][0] ?? "USD",
  };
}

export function classifyPriceFreshness(
  verifiedAt: string | null,
  snapshotPriceMinor: number | null,
  currentPriceMinor: number | null,
  now = new Date(),
  staleDays = 30,
) {
  if (currentPriceMinor === null) return "unavailable" as const;
  if (snapshotPriceMinor === null || !verifiedAt) return "unknown" as const;
  if (snapshotPriceMinor !== currentPriceMinor) return "changed" as const;
  return now.getTime() - new Date(verifiedAt).getTime() > staleDays * 86_400_000
    ? ("stale" as const)
    : ("current" as const);
}
export function budgetVariance(
  estimatedTotalMinor: number,
  targetMaximumMinor: number,
) {
  const amountMinor = estimatedTotalMinor - targetMaximumMinor;
  return {
    amountMinor,
    percentageBasisPoints: targetMaximumMinor
      ? Math.round((amountMinor * 10_000) / targetMaximumMinor)
      : null,
    overBudget: amountMinor > 0,
  };
}
export function isCustomerMaterialChange(fields: readonly string[]) {
  const material = new Set([
    "product",
    "quantity",
    "room",
    "capacity",
    "budget",
    "inclusion_basis",
    "required_cost",
    "timeline",
    "design_direction",
  ]);
  return fields.some((field) => material.has(field));
}
export function validateWorkspaceSelection(product: {
  scope: string;
  workspaceId: string | null;
  status: string;
  productWorkspaceId: string;
}) {
  if (
    product.scope !== "workspace" ||
    product.workspaceId !== product.productWorkspaceId
  )
    throw new Error("DESIGN_PRODUCT_WRONG_WORKSPACE");
  if (product.status !== "approved")
    throw new Error("DESIGN_PRODUCT_INELIGIBLE");
}
export function validateWorkspaceCapacity(input: {
  maximumGuests: number;
  sleeping: number;
  dining: number;
  living: number;
}) {
  return [
    ...(input.sleeping < input.maximumGuests
      ? [
          {
            code: "SLEEPING_CAPACITY_INSUFFICIENT",
            severity: "blocking" as const,
          },
        ]
      : []),
    ...(input.dining < input.maximumGuests
      ? [{ code: "DINING_CAPACITY_INSUFFICIENT", severity: "warning" as const }]
      : []),
    ...(input.living < input.maximumGuests
      ? [{ code: "LIVING_CAPACITY_INSUFFICIENT", severity: "warning" as const }]
      : []),
  ];
}
