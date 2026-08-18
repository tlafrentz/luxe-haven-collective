import { z } from "zod";
import { BASELINE_STATUSES, CONNECTION_STATUSES, FOUNDING_PARTNER_DATA_SOURCES, HPM_PILLARS } from "./activate";
import { ACTION_STATUSES, DAY90_NEXT_STEPS, FEEDBACK_TYPES, OPPORTUNITY_CONFIDENCE, OPPORTUNITY_STATUSES, OUTCOME_STATUSES, SIGNAL_MATURITIES } from "./learn";

const text = (max: number) => z.string().trim().min(2).max(max);
export const foundingPartnerApplicationSchema = z.object({
  firstName: text(80), lastName: text(80), email: z.string().trim().email().max(254), businessName: text(160),
  operatingModel: text(120), propertyCount: z.coerce.number().int().min(0).max(100000), yearsOperating: z.coerce.number().int().min(0).max(200), primaryMarkets: text(500),
  twelveMonthGoal: text(3000), primaryDifficulty: text(3000), improvementArea: text(3000),
  monthlyFeedbackConsent: z.literal("on"), earlyCapabilityConsent: z.literal("on"), programInterest: text(3000), testimonialConsent: z.string().optional(),
});
export type FoundingPartnerApplication = z.infer<typeof foundingPartnerApplicationSchema>;
export const fitValueSchema = z.enum(["strong","moderate","weak","unknown"]);
export const qualificationSchema = z.object({
  programId:z.string().uuid(), growthOrientation:fitValueSchema,businessSeriousness:fitValueSchema,technologyOpenness:fitValueSchema,feedbackWillingness:fitValueSchema,hpmProblemFit:fitValueSchema,learningValue:fitValueSchema,
  recommendation:z.enum(["recommended","discuss","not_fit"]),notes:z.string().trim().min(3).max(5000),
});
export const discoverySchema = z.object({
  programId:z.string().uuid(),businessNotes:z.string().max(10000),performanceNotes:z.string().max(10000),systemsNotes:z.string().max(10000),decisionsNotes:z.string().max(10000),hpmReactionNotes:z.string().max(10000),partnershipFitNotes:z.string().max(10000),twelveMonthBuild:z.string().max(5000),informationGapDecision:z.string().max(5000),tomorrowQuestion:z.string().max(5000),outcome:z.enum(["accept","hold","decline"]),rationale:z.string().trim().min(3).max(5000),
});

export const foundingPartnerPropertySchema = z.object({
  programId:z.string().uuid(),name:text(200),address:z.string().trim().max(500).optional().or(z.literal("")),propertyType:z.string().trim().max(120).optional().or(z.literal("")),unitCount:z.coerce.number().int().min(0).max(100000).optional(),notes:z.string().max(3000).optional().or(z.literal("")),
});
export const dataConnectionSchema = z.object({
  programId:z.string().uuid(),sourceType:z.enum(FOUNDING_PARTNER_DATA_SOURCES),status:z.enum(CONNECTION_STATUSES),notes:z.string().max(3000).optional().or(z.literal("")),
});
export const baselinePillarSchema = z.object({
  programId:z.string().uuid(),pillar:z.enum(HPM_PILLARS),status:z.enum(BASELINE_STATUSES),dataCompletenessPercent:z.coerce.number().int().min(0).max(100),notes:z.string().max(3000).optional().or(z.literal("")),
});

export const opportunitySchema = z.object({
  programId:z.string().uuid(),opportunityId:z.string().uuid().optional().or(z.literal("")),pillar:z.enum(HPM_PILLARS).optional().or(z.literal("")),title:text(300),evidence:z.string().max(5000).optional().or(z.literal("")),whyItMatters:z.string().max(3000).optional().or(z.literal("")),estimatedImpact:z.string().max(1000).optional().or(z.literal("")),confidence:z.enum(OPPORTUNITY_CONFIDENCE),recommendedAction:z.string().max(3000).optional().or(z.literal("")),status:z.enum(OPPORTUNITY_STATUSES),sourceLineage:z.string().max(1000).optional().or(z.literal("")),
});
export const actionSchema = z.object({
  programId:z.string().uuid(),opportunityId:z.string().uuid().optional().or(z.literal("")),decision:text(2000),actionDescription:z.string().max(3000).optional().or(z.literal("")),owner:z.string().max(200).optional().or(z.literal("")),targetDate:z.string().optional().or(z.literal("")),status:z.enum(ACTION_STATUSES),
});
export const outcomeSchema = z.object({
  actionId:z.string().uuid(),programId:z.string().uuid(),status:z.enum(OUTCOME_STATUSES),estimatedValue:z.string().max(500).optional().or(z.literal("")),realizedValue:z.string().max(500).optional().or(z.literal("")),notes:z.string().max(3000).optional().or(z.literal("")),
});
export const monthlyReviewSchema = z.object({
  programId:z.string().uuid(),reviewMonth:z.string().min(7),summary:text(5000),wins:z.string().max(3000).optional().or(z.literal("")),challenges:z.string().max(3000).optional().or(z.literal("")),nextFocus:z.string().max(3000).optional().or(z.literal("")),
});
export const feedbackSchema = z.object({
  programId:z.string().uuid(),feedbackType:z.enum(FEEDBACK_TYPES),signalMaturity:z.enum(SIGNAL_MATURITIES),summary:text(1000),detail:z.string().max(5000).optional().or(z.literal("")),
});
export const day90ReviewSchema = z.object({
  programId:z.string().uuid(),valueDelivered:z.string().max(5000).optional().or(z.literal("")),wouldPay:z.string().optional(),willingnessToPayNotes:z.string().max(3000).optional().or(z.literal("")),testimonialCapture:z.string().max(2000).optional().or(z.literal("")),recommendedNextStep:z.enum(DAY90_NEXT_STEPS),rationale:z.string().trim().min(3).max(5000),
});
