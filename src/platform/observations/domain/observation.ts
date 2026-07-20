import { EntityWithProps } from "../../kernel";

import {
  createObservationId,
  type ObservationId,
} from "./observation-id";
import {
  ObservationProvenance,
  type ObservationProvenanceInput,
} from "./observation-provenance";
import {
  ObservationSource,
  type ObservationSourceInput,
} from "./observation-source";
import {
  ObservationSubject,
  type ObservationSubjectInput,
} from "./observation-subject";
import type { ObservationType } from "./observation-type";
import {
  ObservationUnit,
  type ObservationUnitInput,
} from "./observation-unit";
import type {
  ObservationValue,
} from "./observation-value";

type ObservationProps<
  TValue extends ObservationValue,
> = Readonly<{
  type: ObservationType;
  subject: ObservationSubject;
  label: string;
  value: TValue;
  source: ObservationSource;
  observedAt: Date;
  recordedAt: Date;
  unit?: ObservationUnit;
  provenance?: ObservationProvenance;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

export type ObservationInput<
  TValue extends ObservationValue,
> = Readonly<{
  id?: ObservationId;
  type: ObservationType;
  subject:
    | ObservationSubject
    | ObservationSubjectInput;
  label: string;
  value: TValue;
  source:
    | ObservationSource
    | ObservationSourceInput;
  observedAt: Date;
  recordedAt: Date;
  unit?:
    | ObservationUnit
    | ObservationUnitInput;
  provenance?:
    | ObservationProvenance
    | ObservationProvenanceInput;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

/**
 * Canonical platform representation of a fact detected, retrieved, entered,
 * or calculated by the system.
 */
export class Observation<
  TValue extends ObservationValue,
> extends EntityWithProps<
  ObservationProps<TValue>,
  ObservationId
> {
  private constructor(
    id: ObservationId,
    props: ObservationProps<TValue>,
  ) {
    super(id, props);
  }

  public static create<
    TValue extends ObservationValue,
  >(
    input: ObservationInput<TValue>,
  ): Observation<TValue> {
    const observedAt = copyValidDate(
      input.observedAt,
      "Observation observedAt",
    );
    const recordedAt = copyValidDate(
      input.recordedAt,
      "Observation recordedAt",
    );

    return new Observation(
      input.id ?? createObservationId(),
      {
        type: requireText(
          input.type,
          "Observation type",
        ),
        subject:
          input.subject instanceof ObservationSubject
            ? input.subject
            : ObservationSubject.create(input.subject),
        label: requireText(
          input.label,
          "Observation label",
        ),
        value: input.value,
        source:
          input.source instanceof ObservationSource
            ? input.source
            : ObservationSource.create(input.source),
        observedAt,
        recordedAt,
        ...(input.unit
          ? {
              unit:
                input.unit instanceof ObservationUnit
                  ? input.unit
                  : ObservationUnit.create(input.unit),
            }
          : {}),
        ...(input.provenance
          ? {
              provenance:
                input.provenance instanceof
                ObservationProvenance
                  ? input.provenance
                  : ObservationProvenance.create(
                      input.provenance,
                    ),
            }
          : {}),
        ...(input.metadata
          ? { metadata: input.metadata }
          : {}),
      },
    );
  }

  public get type(): ObservationType {
    return this.props.type;
  }

  public get subject(): ObservationSubject {
    return this.props.subject;
  }

  public get label(): string {
    return this.props.label;
  }

  public get value(): TValue {
    return this.props.value;
  }

  public get source(): ObservationSource {
    return this.props.source;
  }

  public get observedAt(): Date {
    return new Date(this.props.observedAt);
  }

  public get recordedAt(): Date {
    return new Date(this.props.recordedAt);
  }

  public get unit(): ObservationUnit | undefined {
    return this.props.unit;
  }

  public get provenance():
    | ObservationProvenance
    | undefined {
    return this.props.provenance;
  }

  public get metadata():
    | Readonly<Record<string, ObservationValue>>
    | undefined {
    return this.props.metadata;
  }

  public get hasProvenance(): boolean {
    return this.provenance !== undefined;
  }

  public get isDerived(): boolean {
    return this.provenance?.isDerived ?? false;
  }

  public get ageInMilliseconds(): number {
    return Date.now() - this.props.observedAt.getTime();
  }

  public isType(type: ObservationType): boolean {
    return this.type === type;
  }

  public concerns(
    subjectType: string,
    subjectId: string,
  ): boolean {
    return (
      this.subject.type === subjectType &&
      this.subject.id === subjectId
    );
  }
}

function copyValidDate(
  value: Date,
  field: string,
): Date {
  if (
    !(value instanceof Date) ||
    Number.isNaN(value.getTime())
  ) {
    throw new TypeError(`${field} must be valid.`);
  }

  return new Date(value);
}

function requireText(
  value: string,
  field: string,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new TypeError(`${field} cannot be empty.`);
  }

  return normalized;
}
