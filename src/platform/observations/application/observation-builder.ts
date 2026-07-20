import {
  Observation,
  type ObservationInput,
} from "../domain/observation";
import type {
  ObservationId,
} from "../domain/observation-id";
import {
  ObservationProvenance,
  type ObservationProvenanceInput,
} from "../domain/observation-provenance";
import {
  ObservationSource,
  type ObservationSourceInput,
} from "../domain/observation-source";
import {
  ObservationSubject,
  type ObservationSubjectInput,
} from "../domain/observation-subject";
import type {
  ObservationType,
} from "../domain/observation-type";
import {
  ObservationUnit,
  type ObservationUnitInput,
} from "../domain/observation-unit";
import type {
  ObservationValue,
} from "../domain/observation-value";

type ObservationBuilderState<
  TValue extends ObservationValue,
> = Readonly<{
  id?: ObservationId;
  type?: ObservationType;
  subject?: ObservationSubject;
  label?: string;
  value?: TValue;
  hasValue: boolean;
  source?: ObservationSource;
  provenance?: ObservationProvenance;
  observedAt?: Date;
  recordedAt?: Date;
  unit?: ObservationUnit;
  metadata?: Readonly<
    Record<string, ObservationValue>
  >;
}>;

/**
 * Fluent application-layer builder for canonical platform observations.
 *
 * The builder may exist in a partial state. Only `build()` creates a domain
 * Observation, and `build()` rejects any missing required field.
 */
export class ObservationBuilder<
  TValue extends ObservationValue =
    ObservationValue,
> {
  private constructor(
    private readonly state:
      ObservationBuilderState<TValue>,
  ) {}

  public static create():
    ObservationBuilder<ObservationValue> {
    return new ObservationBuilder({
      hasValue: false,
    });
  }

  public static from<
    TValue extends ObservationValue,
  >(
    observation: Observation<TValue>,
  ): ObservationBuilder<TValue> {
    return new ObservationBuilder({
      id: observation.id,
      type: observation.type,
      subject: observation.subject,
      label: observation.label,
      value: observation.value,
      hasValue: true,
      source: observation.source,
      ...(observation.provenance
        ? { provenance: observation.provenance }
        : {}),
      observedAt: observation.observedAt,
      recordedAt: observation.recordedAt,
      ...(observation.unit
        ? { unit: observation.unit }
        : {}),
      ...(observation.metadata
        ? {
            metadata:
              observation.metadata,
          }
        : {}),
    });
  }

  public withId(
    id: ObservationId,
  ): ObservationBuilder<TValue> {
    return this.copy({ id });
  }

  public withType(
    type: ObservationType,
  ): ObservationBuilder<TValue> {
    return this.copy({ type });
  }

  public concerning(
    subject:
      | ObservationSubject
      | ObservationSubjectInput,
  ): ObservationBuilder<TValue> {
    return this.copy({
      subject:
        subject instanceof ObservationSubject
          ? subject
          : ObservationSubject.create(subject),
    });
  }

  public withLabel(
    label: string,
  ): ObservationBuilder<TValue> {
    return this.copy({ label });
  }

  public withValue<
    TNextValue extends ObservationValue,
  >(
    value: TNextValue,
  ): ObservationBuilder<TNextValue> {
    return new ObservationBuilder({
      ...this.state,
      value,
      hasValue: true,
    });
  }

  public fromSource(
    source:
      | ObservationSource
      | ObservationSourceInput,
  ): ObservationBuilder<TValue> {
    return this.copy({
      source:
        source instanceof ObservationSource
          ? source
          : ObservationSource.create(source),
    });
  }

  public withProvenance(
    provenance:
      | ObservationProvenance
      | ObservationProvenanceInput,
  ): ObservationBuilder<TValue> {
    return this.copy({
      provenance:
        provenance instanceof ObservationProvenance
          ? provenance
          : ObservationProvenance.create(
              provenance,
            ),
    });
  }

  public withoutProvenance():
    ObservationBuilder<TValue> {
    return this.copy({
      provenance: undefined,
    });
  }

  public observedAt(
    value: Date,
  ): ObservationBuilder<TValue> {
    return this.copy({
      observedAt: copyDate(value),
    });
  }

  public recordedAt(
    value: Date,
  ): ObservationBuilder<TValue> {
    return this.copy({
      recordedAt: copyDate(value),
    });
  }

  public measuredIn(
    unit:
      | ObservationUnit
      | ObservationUnitInput,
  ): ObservationBuilder<TValue> {
    return this.copy({
      unit:
        unit instanceof ObservationUnit
          ? unit
          : ObservationUnit.create(unit),
    });
  }

  public withoutUnit():
    ObservationBuilder<TValue> {
    return this.copy({
      unit: undefined,
    });
  }

  public withMetadata(
    metadata: Readonly<
      Record<string, ObservationValue>
    >,
  ): ObservationBuilder<TValue> {
    return this.copy({ metadata });
  }

  public withoutMetadata():
    ObservationBuilder<TValue> {
    return this.copy({
      metadata: undefined,
    });
  }

  public build(): Observation<TValue> {
    const missingFields =
      this.getMissingFields();

    if (missingFields.length > 0) {
      throw new Error(
        `Observation builder is missing required fields: ${missingFields.join(", ")}.`,
      );
    }

    const input: ObservationInput<TValue> = {
      ...(this.state.id
        ? { id: this.state.id }
        : {}),
      type: this.state.type!,
      subject: this.state.subject!,
      label: this.state.label!,
      value: this.state.value as TValue,
      source: this.state.source!,
      observedAt: this.state.observedAt!,
      recordedAt: this.state.recordedAt!,
      ...(this.state.unit
        ? { unit: this.state.unit }
        : {}),
      ...(this.state.provenance
        ? { provenance: this.state.provenance }
        : {}),
      ...(this.state.metadata
        ? {
            metadata:
              this.state.metadata,
          }
        : {}),
    };

    return Observation.create(input);
  }

  public getMissingFields():
    readonly string[] {
    const fields: string[] = [];

    if (!this.state.type) {
      fields.push("type");
    }

    if (!this.state.subject) {
      fields.push("subject");
    }

    if (!this.state.label) {
      fields.push("label");
    }

    if (!this.state.hasValue) {
      fields.push("value");
    }

    if (!this.state.source) {
      fields.push("source");
    }

    if (!this.state.observedAt) {
      fields.push("observedAt");
    }

    if (!this.state.recordedAt) {
      fields.push("recordedAt");
    }

    return fields;
  }

  public get isComplete(): boolean {
    return this.getMissingFields().length === 0;
  }

  private copy(
    patch: Partial<
      ObservationBuilderState<TValue>
    >,
  ): ObservationBuilder<TValue> {
    return new ObservationBuilder({
      ...this.state,
      ...patch,
    });
  }
}

function copyDate(
  value: Date,
): Date {
  return new Date(value);
}
