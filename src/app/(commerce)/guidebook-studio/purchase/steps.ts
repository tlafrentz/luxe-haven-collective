export const purchaseSteps = [
  "configure",
  "account",
  "property",
  "select",
  "review",
  "checkout",
] as const;

export const purchaseStepLabels: Record<(typeof purchaseSteps)[number], string> = {
  configure: "Configure",
  account: "Account",
  property: "Property",
  select: "Package",
  review: "Review",
  checkout: "Checkout",
};
