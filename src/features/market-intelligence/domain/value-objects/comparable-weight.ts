export class ComparableWeight {
  readonly value: number;

  constructor(value: number) {
    if (!Number.isFinite(value)) {
      throw new Error("Comparable weight must be a finite number.");
    }

    if (value < 0 || value > 1) {
      throw new Error("Comparable weight must be between 0 and 1.");
    }

    this.value = Math.round(value * 10000) / 10000;
  }

  get percentage(): number { return this.value * 100; }
}
