import {
  EvaluationCollection,
} from "../domain";

export type EvaluationDiagnosticsInput = Readonly<{
  warnings?: readonly string[];
  errors?: readonly string[];
  skippedClaims?: readonly string[];
  failedClaims?: readonly string[];
}>;

export class EvaluationDiagnostics {
  public readonly warnings: readonly string[];
  public readonly errors: readonly string[];
  public readonly skippedClaims: readonly string[];
  public readonly failedClaims: readonly string[];

  private constructor(
    input: EvaluationDiagnosticsInput,
  ) {
    this.warnings = Object.freeze([...(input.warnings ?? [])]);
    this.errors = Object.freeze([...(input.errors ?? [])]);
    this.skippedClaims = Object.freeze([...(input.skippedClaims ?? [])]);
    this.failedClaims = Object.freeze([...(input.failedClaims ?? [])]);
    Object.freeze(this);
  }

  public static create(
    input: EvaluationDiagnosticsInput = {},
  ): EvaluationDiagnostics {
    return new EvaluationDiagnostics(input);
  }
}

export type EvaluationSessionInput = Readonly<{
  startedAt: Date;
  completedAt: Date;
  claimsProcessed: number;
  evaluationsCreated: number;
  claimsSkipped: number;
  claimsFailed: number;
  evaluationCollection: EvaluationCollection;
  diagnostics: EvaluationDiagnostics;
}>;

/** Immutable result of one batch Evaluation execution. */
export class EvaluationSession {
  public readonly startedAt: Date;
  public readonly completedAt: Date;
  public readonly claimsProcessed: number;
  public readonly evaluationsCreated: number;
  public readonly claimsSkipped: number;
  public readonly claimsFailed: number;
  public readonly evaluationCollection: EvaluationCollection;
  public readonly diagnostics: EvaluationDiagnostics;

  private constructor(
    input: EvaluationSessionInput,
  ) {
    this.startedAt = copyDate(input.startedAt, "Evaluation session start date");
    this.completedAt = copyDate(input.completedAt, "Evaluation session completion date");

    if (this.completedAt.getTime() < this.startedAt.getTime()) {
      throw new RangeError(
        "Evaluation session completion date cannot precede start date.",
      );
    }

    this.claimsProcessed = requireCount(input.claimsProcessed, "Claims processed");
    this.evaluationsCreated = requireCount(input.evaluationsCreated, "Evaluations created");
    this.claimsSkipped = requireCount(input.claimsSkipped, "Claims skipped");
    this.claimsFailed = requireCount(input.claimsFailed, "Claims failed");

    if (
      this.evaluationsCreated + this.claimsSkipped + this.claimsFailed !==
      this.claimsProcessed
    ) {
      throw new RangeError(
        "Evaluation session outcomes must equal the number of Claims processed.",
      );
    }

    if (input.evaluationCollection.size !== this.evaluationsCreated) {
      throw new RangeError(
        "Evaluation collection size must equal the number of Evaluations created.",
      );
    }

    this.evaluationCollection = input.evaluationCollection;
    this.diagnostics = input.diagnostics;
    Object.freeze(this);
  }

  public static create(input: EvaluationSessionInput): EvaluationSession {
    return new EvaluationSession(input);
  }

  public get durationMs(): number {
    return this.completedAt.getTime() - this.startedAt.getTime();
  }

  public get succeeded(): boolean {
    return this.claimsFailed === 0;
  }
}

function copyDate(value: Date, field: string): Date {
  const copy = new Date(value.getTime());

  if (Number.isNaN(copy.getTime())) {
    throw new TypeError(`${field} must be valid.`);
  }

  return copy;
}

function requireCount(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative integer.`);
  }

  return value;
}
