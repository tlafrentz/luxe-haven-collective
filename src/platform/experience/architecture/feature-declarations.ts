export type ExperienceWorkspace="Client Workspace"|"Executive Intelligence"|"Financial Intelligence"|"Investment Intelligence"|"Operations Console";
export type HpmLifecycleStage="Observe"|"Understand"|"Decide"|"Execute"|"Learn"|"Infrastructure";
export type WorkspacePattern="Briefing"|"Overview → Manage"|"Overview → Insights"|"List → Detail"|"Overview → Monitor"|"Guided workflow → Decision";
export type ExperienceFeatureDeclaration=Readonly<{feature:string;workspace:ExperienceWorkspace;stage:HpmLifecycleStage;pattern:WorkspacePattern}>;
export const EXPERIENCE_FEATURE_DECLARATIONS:readonly ExperienceFeatureDeclaration[]=Object.freeze([
 {feature:"Executive Brief",workspace:"Executive Intelligence",stage:"Understand",pattern:"Briefing"},
 {feature:"Expense Entry",workspace:"Financial Intelligence",stage:"Understand",pattern:"Overview → Manage"},
 {feature:"Opportunity Pipeline",workspace:"Investment Intelligence",stage:"Decide",pattern:"List → Detail"},
 {feature:"Investment Analysis",workspace:"Investment Intelligence",stage:"Decide",pattern:"Guided workflow → Decision"},
 {feature:"Provider Health",workspace:"Operations Console",stage:"Infrastructure",pattern:"Overview → Monitor"},
 {feature:"Support Tickets",workspace:"Operations Console",stage:"Execute",pattern:"List → Detail"},
]);
export function declareExperienceFeature(value:ExperienceFeatureDeclaration){if(!value.feature.trim())throw new Error("Experience feature name is required.");return Object.freeze({...value});}
