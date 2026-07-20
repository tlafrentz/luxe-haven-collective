import type {
  ObservationCollection,
} from "../domain/observation-collection";

/**
 * Permanent platform contract implemented by capabilities that emit canonical
 * observations.
 *
 * Providers own translation from feature-domain outputs into the Observation
 * Platform. They must not move feature business rules into platform code.
 */
export interface ObservationProvider<TInput> {
  readonly capability: string;

  build(
    input: TInput,
  ): ObservationCollection;
}
