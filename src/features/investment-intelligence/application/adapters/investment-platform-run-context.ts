import type {
  InvestmentUpstreamInputs,
} from "./investment-upstream-adapter";

export type InvestmentInputSourceQuality =
  Readonly<{
    comparables?:
      | "verified"
      | "synthetic"
      | "unknown";
    utilitiesResponsibility?:
      | "verified"
      | "unknown";
    regulation?:
      | "verified"
      | "unknown";
  }>;

export type InvestmentPlatformRunContext =
  Readonly<{
    runId: string;
    observedAt: Date;
    recordedAt?: Date;
    upstream?: InvestmentUpstreamInputs;
    sourceQuality?:
      InvestmentInputSourceQuality;
  }>;

export function createInvestmentPlatformRunContext(
  now: Date = new Date(),
): InvestmentPlatformRunContext {
  const observedAt = copyValidDate(now);

  return {
    runId:
      `investment-run-${observedAt.toISOString()}`,
    observedAt,
    recordedAt: observedAt,
  };
}

export function normalizeInvestmentPlatformRunContext(
  context: InvestmentPlatformRunContext,
): InvestmentPlatformRunContext & {
  readonly recordedAt: Date;
} {
  const runId = context.runId.trim();

  if (runId.length === 0) {
    throw new TypeError(
      "Investment Platform run ID cannot be empty.",
    );
  }

  return {
    ...context,
    runId,
    observedAt:
      copyValidDate(context.observedAt),
    recordedAt:
      copyValidDate(
        context.recordedAt ??
          context.observedAt,
      ),
  };
}

function copyValidDate(value: Date): Date {
  const result = new Date(value);

  if (Number.isNaN(result.getTime())) {
    throw new TypeError(
      "Investment Platform artifact date must be valid.",
    );
  }

  return result;
}
