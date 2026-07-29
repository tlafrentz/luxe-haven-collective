import type { ExecutiveBusinessHealthProjection } from "../domain";
export interface ExecutiveHealthProjectionWriter{put(projection:ExecutiveBusinessHealthProjection,actorProfileId:string):Promise<void>}
