import { Identifier } from "@/platform/kernel";
import type { PortfolioLearningAssessmentId, PortfolioLearningId } from "./model";

export const createPortfolioLearningId = (value: string): PortfolioLearningId => Identifier.create(value);
export const createPortfolioLearningAssessmentId = (value: string): PortfolioLearningAssessmentId => Identifier.create(value);
