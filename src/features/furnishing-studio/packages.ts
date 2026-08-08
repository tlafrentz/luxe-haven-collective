import type { QuantityFacts } from "./schema";

export type PackageEstimateLine = Readonly<{
  quantity: number;
  unitPriceMinor: number | null;
  unitsPerPurchase?: number;
}>;

export function estimatePackage(lines: readonly PackageEstimateLine[]) {
  let estimatedTotalMinor = 0,
    priced = 0;
  for (const line of lines) {
    if (line.unitPriceMinor === null) continue;
    const purchases = Math.ceil(line.quantity / (line.unitsPerPurchase ?? 1));
    estimatedTotalMinor += purchases * line.unitPriceMinor;
    priced++;
  }
  return {
    estimatedTotalMinor,
    priced,
    missingPrice: lines.length - priced,
    coveragePercent: lines.length
      ? Math.round((priced / lines.length) * 100)
      : 0,
  };
}

export function resolveComposition(
  rule: Readonly<{
    kind: "fixed" | "bedrooms_minus" | "per_bathroom";
    value: number;
  }>,
  facts: Pick<QuantityFacts, "bedrooms" | "bathrooms">,
) {
  if (rule.kind === "fixed") return Math.max(0, rule.value);
  if (rule.kind === "per_bathroom")
    return Math.max(0, facts.bathrooms * rule.value);
  return Math.max(0, facts.bedrooms - rule.value);
}

export function validateRoomPackage(
  items: readonly Readonly<{
    requirementId: string;
    priority: "required" | "recommended" | "optional";
    quantityRuleId: string | null;
    productId: string | null;
    productStatus?: string | null;
    hasActiveOffer?: boolean;
    hasPrice?: boolean;
  }>[],
) {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.requirementId)) issues.push("Duplicate requirement");
    seen.add(item.requirementId);
    if (!item.quantityRuleId) issues.push("Missing quantity rule");
    if (item.priority === "required" && !item.productId)
      issues.push("Required requirement missing product");
    if (item.productStatus === "discontinued")
      issues.push("Recommended product discontinued");
    if (item.productId && item.hasActiveOffer === false)
      issues.push("No active product offer");
    if (item.productId && item.hasPrice === false)
      issues.push("Missing representative price");
  }
  return [...new Set(issues)];
}
