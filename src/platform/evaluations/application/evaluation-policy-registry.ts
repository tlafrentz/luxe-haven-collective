import {
  type EvaluationPolicy,
  type EvaluationPolicyContext,
} from "./evaluation-policy";

/**
 * Immutable registry for selecting the single Evaluation policy that supports a
 * Claim and Evidence context.
 */
export class EvaluationPolicyRegistry {
  private readonly policies:
    readonly EvaluationPolicy[];

  private constructor(
    policies:
      readonly EvaluationPolicy[],
  ) {
    assertUniquePolicyNames(
      policies,
    );

    this.policies = Object.freeze([
      ...policies,
    ]);
  }

  public static empty():
    EvaluationPolicyRegistry {
    return new EvaluationPolicyRegistry(
      [],
    );
  }

  public static create(
    policies:
      readonly EvaluationPolicy[],
  ): EvaluationPolicyRegistry {
    return new EvaluationPolicyRegistry(
      policies,
    );
  }

  public get size(): number {
    return this.policies.length;
  }

  public register(
    policy: EvaluationPolicy,
  ): EvaluationPolicyRegistry {
    return new EvaluationPolicyRegistry([
      ...this.policies,
      policy,
    ]);
  }

  public supporting(
    context: EvaluationPolicyContext,
  ): readonly EvaluationPolicy[] {
    return this.policies.filter(
      (policy) =>
        policy.supports(
          context,
        ),
    );
  }

  public resolve(
    context: EvaluationPolicyContext,
  ): EvaluationPolicy {
    const supported =
      this.supporting(
        context,
      );

    if (
      supported.length === 0
    ) {
      throw new RangeError(
        `No Evaluation policy supports Claim "${context.claim.id.value}".`,
      );
    }

    if (
      supported.length > 1
    ) {
      throw new RangeError(
        `Multiple Evaluation policies support Claim "${context.claim.id.value}": ${supported
          .map(
            (policy) =>
              policy.name,
          )
          .join(", ")}.`,
      );
    }

    return supported[0];
  }

  public toArray():
    readonly EvaluationPolicy[] {
    return [
      ...this.policies,
    ];
  }
}

function assertUniquePolicyNames(
  policies:
    readonly EvaluationPolicy[],
): void {
  const names =
    policies.map(
      (policy) =>
        requireText(
          policy.name,
          "Evaluation policy name",
        ),
    );

  if (
    new Set(names).size !==
    names.length
  ) {
    throw new RangeError(
      "Evaluation policy names must be unique.",
    );
  }
}

function requireText(
  value: string,
  field: string,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length === 0
  ) {
    throw new TypeError(
      `${field} cannot be empty.`,
    );
  }

  return normalized;
}
