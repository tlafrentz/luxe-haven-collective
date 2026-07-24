import { Identifier } from "@/platform/kernel";
import type { RecommendationEffectivenessAssessmentId, RecommendationTypeId } from "./model";

export const createRecommendationTypeId = (value: string): RecommendationTypeId => Identifier.create(value);
export const createRecommendationEffectivenessAssessmentId = (value: string): RecommendationEffectivenessAssessmentId => Identifier.create(value);
