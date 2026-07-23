import type { AcquisitionRequirementTemplate } from "./acquisition-requirement-template";
export const PURCHASE_ACQUISITION_REQUIREMENT_TEMPLATES: readonly AcquisitionRequirementTemplate[] = [
  { key: "purchase.inspection-contingency", version: 1, route: "purchase", category: "property-condition", title: "Inspection contingency", description: "Record the inspection condition and outcome.", requirementType: "contingency", defaultBlocking: true, defaultPriority: "high", suggestedStage: "due-diligence" },
  { key: "purchase.title-review", version: 1, route: "purchase", category: "title", title: "Title review", description: "Verify recorded ownership and title information.", requirementType: "due-diligence", defaultBlocking: true, defaultPriority: "high", suggestedStage: "due-diligence" },
  { key: "purchase.insurance-verification", version: 1, route: "purchase", category: "insurance", title: "Insurance availability", description: "Record insurance availability and terms.", requirementType: "due-diligence", defaultBlocking: true, defaultPriority: "normal", suggestedStage: "due-diligence" },
];
export const RENTAL_ARBITRAGE_ACQUISITION_REQUIREMENT_TEMPLATES: readonly AcquisitionRequirementTemplate[] = [
  { key: "rental.landlord-str-authorization", version: 1, route: "rental-arbitrage", category: "landlord-authorization", title: "Landlord STR authorization", description: "Record the operating permission fact.", requirementType: "contingency", defaultBlocking: true, defaultPriority: "critical", suggestedStage: "due-diligence" },
  { key: "rental.lease-review", version: 1, route: "rental-arbitrage", category: "lease", title: "Lease review", description: "Record review of lease restrictions and terms.", requirementType: "due-diligence", defaultBlocking: true, defaultPriority: "high", suggestedStage: "due-diligence" },
  { key: "rental.utility-responsibilities", version: 1, route: "rental-arbitrage", category: "utilities", title: "Utility responsibilities", description: "Verify recorded utility responsibilities.", requirementType: "due-diligence", defaultBlocking: false, defaultPriority: "normal", suggestedStage: "due-diligence" },
];
