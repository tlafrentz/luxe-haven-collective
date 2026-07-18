import { DataProvenance } from "../value-objects/data-provenance";

export class MarketObservation {
  constructor(
    readonly type: string,
    readonly value: unknown,
    readonly provenance: DataProvenance,
    readonly observedAt: Date = new Date(),
  ) {}

  get confidence() {
    return this.provenance.confidence;
  }

  get provider() {
    return this.provenance.provider;
  }
}
