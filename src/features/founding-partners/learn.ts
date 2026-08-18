export const OPPORTUNITY_CONFIDENCE = ["strong", "moderate", "weak", "unknown"] as const;
export type OpportunityConfidence = (typeof OPPORTUNITY_CONFIDENCE)[number];
export const OPPORTUNITY_STATUSES = ["identified", "reviewing", "actioned", "deferred", "dismissed"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const ACTION_STATUSES = ["planned", "in_progress", "completed", "abandoned"] as const;
export type FoundingPartnerActionStatus = (typeof ACTION_STATUSES)[number];

export const OUTCOME_STATUSES = ["not_measured", "in_progress", "measured", "inconclusive"] as const;
export type FoundingPartnerOutcomeStatus = (typeof OUTCOME_STATUSES)[number];

export const FEEDBACK_TYPES = ["feature_request", "pain_point", "positive_signal", "concern", "question"] as const;
export type FoundingPartnerFeedbackType = (typeof FEEDBACK_TYPES)[number];
export const FEEDBACK_TYPE_LABELS: Record<FoundingPartnerFeedbackType, string> = {
  feature_request: "Feature request", pain_point: "Pain point", positive_signal: "Positive signal",
  concern: "Concern", question: "Question",
};

export const SIGNAL_MATURITIES = ["early_signal", "recurring_theme", "validated_pattern"] as const;
export type SignalMaturity = (typeof SIGNAL_MATURITIES)[number];
export const SIGNAL_MATURITY_LABELS: Record<SignalMaturity, string> = {
  early_signal: "Early signal", recurring_theme: "Recurring theme", validated_pattern: "Validated pattern",
};

export const DAY90_NEXT_STEPS = ["convert", "extend", "exit"] as const;
export type Day90NextStep = (typeof DAY90_NEXT_STEPS)[number];
export const DAY90_NEXT_STEP_LABELS: Record<Day90NextStep, string> = {
  convert: "Performance Partnership / Platform Subscription", extend: "Extended Design Partnership", exit: "Exit",
};
