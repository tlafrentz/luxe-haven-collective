import type { HpmLifecycleProjection } from "../domain";
import { buildHpmLifecycleProjection } from "./build-hpm-lifecycle-projection";
import {
  getCurrentHpmCanonicalInputs,
  type CurrentHpmCanonicalAssembly,
  type CurrentHpmQuery,
  type CurrentHpmSourceContext,
} from "./get-current-hpm-canonical-inputs";

export type CurrentHpmLifecycleResult = Readonly<{
  lifecycle: HpmLifecycleProjection;
  context: CurrentHpmSourceContext;
}>;

export type CurrentHpmCanonicalInputQuery = (
  query: CurrentHpmQuery,
) => Promise<CurrentHpmCanonicalAssembly>;

/** Shared production query for the current canonical HPM lifecycle. */
export async function getCurrentHpmLifecycleProjection(
  query: CurrentHpmQuery,
  getInputs: CurrentHpmCanonicalInputQuery = getCurrentHpmCanonicalInputs,
): Promise<CurrentHpmLifecycleResult> {
  const assembly = await getInputs(query);
  return Object.freeze({
    lifecycle: buildHpmLifecycleProjection(assembly.inputs, {
      now: assembly.inputs.analytics?.generatedAt,
    }),
    context: assembly.context,
  });
}
