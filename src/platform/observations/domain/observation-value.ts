export type ObservationScalar =
  | string
  | number
  | boolean
  | null;

export type ObservationRecord =
  Readonly<Record<string, ObservationScalar>>;

/**
 * Serialization-safe values accepted by the platform Observation model.
 *
 * Feature domain objects should be translated into one of these values at the
 * application boundary rather than stored directly.
 */
export type ObservationValue =
  | ObservationScalar
  | readonly ObservationScalar[]
  | ObservationRecord;
