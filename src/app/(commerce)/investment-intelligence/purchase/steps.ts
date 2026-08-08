export const purchaseSteps = [
  "configure",
  "account",
  "review",
  "checkout",
] as const;

export const purchaseStepLabels: Record<(typeof purchaseSteps)[number], string> = {
  configure: "Configure",
  account: "Account",
  review: "Review",
  checkout: "Checkout",
};
