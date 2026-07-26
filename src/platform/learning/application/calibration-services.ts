import {
  applyCalibrationToLesson, createLearningCalibration,
  type CalibrationPolicy, type LearningCalibration, type LearningGovernanceEvent,
  type OrganizationalLesson,
} from "../domain";

export interface LearningCalibrationRepository {
  appendCalibration(calibration:LearningCalibration):Promise<void>;
  appendLessonRevision(lesson:OrganizationalLesson):Promise<void>;
  appendGovernanceEvents(events:readonly LearningGovernanceEvent[]):Promise<void>;
  getLesson(workspaceId:string,id:string):Promise<OrganizationalLesson|null>;
  getCalibration(workspaceId:string,id:string):Promise<LearningCalibration|null>;
}
export async function requestLearningCalibration(repository:LearningCalibrationRepository,
  input:LearningCalibration,lesson:OrganizationalLesson,policy?:CalibrationPolicy){
  const result=createLearningCalibration(input,lesson,policy);await repository.appendCalibration(result.calibration);
  await repository.appendGovernanceEvents([result.event]);return result.calibration;
}
export async function approveLearningCalibrationRecord(repository:LearningCalibrationRepository,
  calibration:LearningCalibration,lesson:OrganizationalLesson,input:{
    newLessonId:string;approvedByProfileId:string;approvedAt:string;authorized:boolean;
  }){
  const result=applyCalibrationToLesson(calibration,lesson,input);
  await repository.appendCalibration(result.calibration);await repository.appendLessonRevision(result.lesson);
  await repository.appendGovernanceEvents(result.events);return result;
}
