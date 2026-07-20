import {
  Observation,
} from "../domain/observation";
import {
  ObservationCollection,
  type AnyObservation,
} from "../domain/observation-collection";
import type {
  ObservationValue,
} from "../domain/observation-value";
import {
  ObservationBuilder,
} from "./observation-builder";

/**
 * Application-layer builder for incrementally assembling immutable
 * ObservationCollection snapshots.
 */
export class ObservationCollectionBuilder<
  TObservation extends AnyObservation =
    AnyObservation,
> {
  private constructor(
    private readonly observations:
      readonly TObservation[],
  ) {}

  public static create<
    TObservation extends AnyObservation =
      AnyObservation,
  >(): ObservationCollectionBuilder<TObservation> {
    return new ObservationCollectionBuilder(
      [],
    );
  }

  public static from<
    TObservation extends AnyObservation,
  >(
    collection:
      ObservationCollection<TObservation>,
  ): ObservationCollectionBuilder<TObservation> {
    return new ObservationCollectionBuilder(
      collection.toArray(),
    );
  }

  public add(
    observation: TObservation,
  ): ObservationCollectionBuilder<TObservation> {
    return new ObservationCollectionBuilder([
      ...this.observations,
      observation,
    ]);
  }

  public addMany(
    observations: readonly TObservation[],
  ): ObservationCollectionBuilder<TObservation> {
    return new ObservationCollectionBuilder([
      ...this.observations,
      ...observations,
    ]);
  }

  public addBuilt<
    TValue extends ObservationValue,
  >(
    builder: ObservationBuilder<TValue>,
  ): ObservationCollectionBuilder<
    TObservation | Observation<TValue>
  > {
    return new ObservationCollectionBuilder([
      ...this.observations,
      builder.build(),
    ]);
  }

  public build():
    ObservationCollection<TObservation> {
    return ObservationCollection.create(
      this.observations,
    );
  }

  public get size(): number {
    return this.observations.length;
  }
}
