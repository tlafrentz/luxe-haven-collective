"use server";
import type {
  ActivateAcquisitionPipelineServerInput,
  BeginClosingPreparationServerInput,
  CloseAcquisitionServerInput,
  CreateAcquisitionOfferServerInput,
  ExitAcquisitionPipelineServerInput,
  RecordAcquisitionContractServerInput,
  SubmitAcquisitionOfferServerInput,
  TransitionAcquisitionStageServerInput,
} from "@/features/investment-opportunity/acquisition-server";
import { createProductionAcquisitionServerCommandBoundary } from "./acquisition-workspace-command-runtime";

export async function activateAcquisitionPipelineAction(input: ActivateAcquisitionPipelineServerInput) {
  return createProductionAcquisitionServerCommandBoundary().execute(input);
}
export async function transitionAcquisitionStageAction(input: TransitionAcquisitionStageServerInput) {
  return createProductionAcquisitionServerCommandBoundary().execute(input);
}
export async function createAcquisitionOfferAction(input: CreateAcquisitionOfferServerInput) {
  return createProductionAcquisitionServerCommandBoundary().execute(input);
}
export async function submitAcquisitionOfferAction(input: SubmitAcquisitionOfferServerInput) {
  return createProductionAcquisitionServerCommandBoundary().execute(input);
}
export async function recordAcquisitionContractAction(input: RecordAcquisitionContractServerInput) {
  return createProductionAcquisitionServerCommandBoundary().execute(input);
}
export async function beginClosingPreparationAction(input: BeginClosingPreparationServerInput) {
  return createProductionAcquisitionServerCommandBoundary().execute(input);
}
export async function closeAcquisitionAction(input: CloseAcquisitionServerInput) {
  return createProductionAcquisitionServerCommandBoundary().execute(input);
}
export async function exitAcquisitionPipelineAction(input: ExitAcquisitionPipelineServerInput) {
  return createProductionAcquisitionServerCommandBoundary().execute(input);
}
