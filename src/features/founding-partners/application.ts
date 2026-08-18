import { z } from "zod";

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
