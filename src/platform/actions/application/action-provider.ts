import type { PlatformAction, PlatformActionCollection } from "../domain";
import type { ArchiveActionCommand, AssignActionCommand, BlockActionCommand, CancelActionCommand, ChangeActionOwnerCommand, ChangeActionPriorityCommand, ClaimActionCommand, CommitActionCommand, CompleteActionCommand, CreateCommittedActionCommand, CreateDraftActionCommand, FailActionCommand, LinkActionOutcomeCommand, MarkActionReadyCommand, ReleaseActionAssignmentCommand, ReopenActionCommand, RetryActionCommand, ReturnActionForCorrectionCommand, ScheduleActionCommand, StartActionCommand, SubmitActionForReviewCommand, UnblockActionCommand } from "./action-commands";
import type { FindActionByIdQuery, PlatformActionQuery } from "./action-queries";
export interface PlatformActionProvider {
  createDraft(command: CreateDraftActionCommand): Promise<PlatformAction>;
  createCommitted(command: CreateCommittedActionCommand): Promise<PlatformAction>;
  commit(command: CommitActionCommand): Promise<PlatformAction>;
  assign(command: AssignActionCommand): Promise<PlatformAction>;
  releaseAssignment(command: ReleaseActionAssignmentCommand): Promise<PlatformAction>;
  claim(command: ClaimActionCommand): Promise<PlatformAction>;
  schedule(command: ScheduleActionCommand): Promise<PlatformAction>;
  markReady(command: MarkActionReadyCommand): Promise<PlatformAction>;
  start(command: StartActionCommand): Promise<PlatformAction>;
  block(command: BlockActionCommand): Promise<PlatformAction>;
  unblock(command: UnblockActionCommand): Promise<PlatformAction>;
  submitForReview(command: SubmitActionForReviewCommand): Promise<PlatformAction>;
  returnForCorrection(command: ReturnActionForCorrectionCommand): Promise<PlatformAction>;
  complete(command: CompleteActionCommand): Promise<PlatformAction>;
  fail(command: FailActionCommand): Promise<PlatformAction>;
  retry(command: RetryActionCommand): Promise<PlatformAction>;
  reopen(command: ReopenActionCommand): Promise<PlatformAction>;
  cancel(command: CancelActionCommand): Promise<PlatformAction>;
  archive(command: ArchiveActionCommand): Promise<PlatformAction>;
  linkOutcome(command: LinkActionOutcomeCommand): Promise<PlatformAction>;
  changePriority(command: ChangeActionPriorityCommand): Promise<PlatformAction>;
  changeOwner(command: ChangeActionOwnerCommand): Promise<PlatformAction>;
  findById(query: FindActionByIdQuery): Promise<PlatformAction | null>;
  find(query: PlatformActionQuery): Promise<PlatformActionCollection>;
}
