export type BusinessType = "individual-owner" | "co-host" | "small-portfolio" | "enterprise";
export type PropertyCount = "1" | "2-5" | "6-20" | "20+";
export type PrimaryGoal =
  | "increase-revenue"
  | "guest-experience"
  | "launch-property"
  | "investment"
  | "operations";

export const businessTypeLabels: Record<BusinessType, string> = {
  "individual-owner": "Individual Owner",
  "co-host": "Co-Host",
  "small-portfolio": "Small Portfolio",
  enterprise: "Enterprise",
};

export const propertyCountLabels: Record<PropertyCount, string> = {
  "1": "1",
  "2-5": "2–5",
  "6-20": "6–20",
  "20+": "20+",
};

export const primaryGoalLabels: Record<PrimaryGoal, string> = {
  "increase-revenue": "Increase Revenue",
  "guest-experience": "Guest Experience",
  "launch-property": "Launch Property",
  investment: "Investment",
  operations: "Operations",
};

export const integrationOptions = ["Airbnb", "Vrbo", "Guesty", "Hostaway", "Hospitable", "None Yet"] as const;

export type WorkspaceConfigAnswers = {
  businessType?: BusinessType;
  propertyCount?: PropertyCount;
  primaryGoal?: PrimaryGoal;
  integrations?: string[];
  preferredOnboardingDate?: string;
};

export function isWorkspaceConfigComplete(
  answers: WorkspaceConfigAnswers,
): answers is Required<Pick<WorkspaceConfigAnswers, "businessType" | "propertyCount" | "primaryGoal">> &
  WorkspaceConfigAnswers {
  return Boolean(answers.businessType && answers.propertyCount && answers.primaryGoal);
}
