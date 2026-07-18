import {
  ConfidenceScore,
} from "./confidence-score";

import {
  ProviderType,
} from "../enums/provider-type";

export class DataProvenance {
  constructor(
    readonly provider: ProviderType,
    readonly retrievedAt: Date,
    readonly confidence: ConfidenceScore,
    readonly sampleSize?: number,
    readonly notes?: string,
    readonly version?: string,
  ) {
    if (
      sampleSize !== undefined &&
      sampleSize < 0
    ) {
      throw new Error(
        "Sample size cannot be negative.",
      );
    }
  }

  get hasSample(): boolean {
    return (
      this.sampleSize !== undefined &&
      this.sampleSize > 0
    );
  }

  get ageInHours(): number {
    const milliseconds =
      Date.now() -
      this.retrievedAt.getTime();

    return milliseconds / 3_600_000;
  }

  get isManual(): boolean {
    return (
      this.provider ===
      ProviderType.Manual
    );
  }

  get isInternal(): boolean {
    return (
      this.provider ===
      ProviderType.Internal
    );
  }
}
