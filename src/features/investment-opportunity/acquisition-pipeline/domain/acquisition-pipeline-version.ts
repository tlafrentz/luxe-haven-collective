import { AcquisitionDomainError } from "./errors";

export class AcquisitionPipelineVersion {
  private constructor(public readonly value: number) { Object.freeze(this); }
  public static initial(): AcquisitionPipelineVersion { return new AcquisitionPipelineVersion(1); }
  public static from(value: number): AcquisitionPipelineVersion { if (!Number.isInteger(value) || value <= 0) throw new AcquisitionDomainError("INVALID_ACQUISITION_PIPELINE_VERSION", { value }); return new AcquisitionPipelineVersion(value); }
  public next(): AcquisitionPipelineVersion { return AcquisitionPipelineVersion.from(this.value + 1); }
  public equals(other: AcquisitionPipelineVersion): boolean { return this.value === other.value; }
  public toJSON(): number { return this.value; }
}
