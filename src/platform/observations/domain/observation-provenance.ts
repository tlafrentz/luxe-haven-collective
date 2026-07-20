import { ValueObject } from "../../kernel";

import type {
  ObservationId,
} from "./observation-id";

export type ObservationProvenanceInput = Readonly<{
  retrievedAt: Date;
  effectiveAt?: Date;
  sampleSize?: number;
  notes?: string;
  version?: string;
  sourceObservationIds?: readonly ObservationId[];
}>;

type ObservationProvenanceProps = Readonly<{
  retrievedAt: Date;
  effectiveAt?: Date;
  sampleSize?: number;
  notes?: string;
  version?: string;
  sourceObservationIds: readonly ObservationId[];
}>;

/**
 * Describes how and when an observation entered the platform and which prior
 * observations contributed to it.
 *
 * Confidence and quality are deliberately excluded. Those belong to scoring.
 */
export class ObservationProvenance extends ValueObject<ObservationProvenanceProps> {
  private constructor(
    props: ObservationProvenanceProps,
  ) {
    super(props);
  }

  public static create(
    input: ObservationProvenanceInput,
  ): ObservationProvenance {
    const retrievedAt = copyValidDate(
      input.retrievedAt,
      "Observation provenance retrievedAt",
    );

    const effectiveAt =
      input.effectiveAt === undefined
        ? undefined
        : copyValidDate(
            input.effectiveAt,
            "Observation provenance effectiveAt",
          );

    if (
      input.sampleSize !== undefined &&
      (
        !Number.isInteger(input.sampleSize) ||
        input.sampleSize < 0
      )
    ) {
      throw new RangeError(
        "Observation provenance sample size must be a non-negative integer.",
      );
    }

    return new ObservationProvenance({
      retrievedAt,
      ...(effectiveAt
        ? { effectiveAt }
        : {}),
      ...(input.sampleSize !== undefined
        ? { sampleSize: input.sampleSize }
        : {}),
      ...optionalText(
        "notes",
        input.notes,
        "Observation provenance notes",
      ),
      ...optionalText(
        "version",
        input.version,
        "Observation provenance version",
      ),
      sourceObservationIds: Object.freeze([
        ...(input.sourceObservationIds ?? []),
      ]),
    });
  }

  public get retrievedAt(): Date {
    return new Date(
      this.props.retrievedAt,
    );
  }

  public get effectiveAt(): Date | undefined {
    return this.props.effectiveAt
      ? new Date(this.props.effectiveAt)
      : undefined;
  }

  public get sampleSize(): number | undefined {
    return this.props.sampleSize;
  }

  public get notes(): string | undefined {
    return this.props.notes;
  }

  public get version(): string | undefined {
    return this.props.version;
  }

  public get sourceObservationIds():
    readonly ObservationId[] {
    return [...this.props.sourceObservationIds];
  }

  public get hasSample(): boolean {
    return (
      this.sampleSize !== undefined &&
      this.sampleSize > 0
    );
  }

  public get isDerived(): boolean {
    return this.sourceObservationIds.length > 0;
  }

  public get ageInMilliseconds(): number {
    return (
      Date.now() -
      this.props.retrievedAt.getTime()
    );
  }

  public isOlderThan(
    durationInMilliseconds: number,
    now: Date = new Date(),
  ): boolean {
    if (
      !Number.isFinite(durationInMilliseconds) ||
      durationInMilliseconds < 0
    ) {
      throw new RangeError(
        "Observation provenance duration must be a non-negative finite number.",
      );
    }

    const referenceTime = copyValidDate(
      now,
      "Observation provenance reference time",
    );

    return (
      referenceTime.getTime() -
        this.props.retrievedAt.getTime() >
      durationInMilliseconds
    );
  }

  public includesSourceObservation(
    id: ObservationId,
  ): boolean {
    return this.props.sourceObservationIds.some(
      (sourceId) => sourceId.equals(id),
    );
  }
}

function optionalText<
  TKey extends "notes" | "version",
>(
  key: TKey,
  value: string | undefined,
  field: string,
): Partial<Record<TKey, string>> {
  if (value === undefined) {
    return {};
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new TypeError(
      `${field} cannot be empty.`,
    );
  }

  return {
    [key]: normalized,
  } as Partial<Record<TKey, string>>;
}

function copyValidDate(
  value: Date,
  field: string,
): Date {
  if (
    !(value instanceof Date) ||
    Number.isNaN(value.getTime())
  ) {
    throw new TypeError(
      `${field} must be valid.`,
    );
  }

  return new Date(value);
}
