import type { AcquisitionServerCommandType } from "./contracts";

const overview = "/dashboard/investments";
const portfolio = "/dashboard/investments/opportunities";
export function acquisitionCommandRevalidationPaths(commandType: AcquisitionServerCommandType, opportunityId: string): readonly string[] {
  const detail = `${portfolio}/${opportunityId}`;
  if (commandType === "activate-pipeline" || commandType === "exit-pipeline" || commandType === "close-acquisition") return Object.freeze([overview, portfolio, detail]);
  if (commandType === "submit-offer" || commandType === "record-contract" || commandType === "transition-stage") return Object.freeze([portfolio, detail]);
  return Object.freeze([detail]);
}

export interface AcquisitionCommandRevalidator {
  revalidate(paths: readonly string[]): Promise<void>;
}
