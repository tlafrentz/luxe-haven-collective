import type { RecommendationPolicy } from "./recommendation-policy";

/** Immutable registry of recommendation reasoning policies. */
export class RecommendationPolicyRegistry implements Iterable<RecommendationPolicy> {
  private readonly policies: readonly RecommendationPolicy[];

  private constructor(policies: readonly RecommendationPolicy[]) {
    validatePolicies(policies);
    this.policies = Object.freeze([...policies]);
  }

  public static empty(): RecommendationPolicyRegistry {
    return new RecommendationPolicyRegistry([]);
  }

  public static create(policies: readonly RecommendationPolicy[]): RecommendationPolicyRegistry {
    return new RecommendationPolicyRegistry(policies);
  }

  public get size(): number { return this.policies.length; }
  public register(policy: RecommendationPolicy): RecommendationPolicyRegistry {
    return new RecommendationPolicyRegistry([...this.policies, policy]);
  }
  public get(name: string): RecommendationPolicy | undefined {
    const normalized = requireText(name);
    return this.policies.find((policy) => policy.name.trim() === normalized);
  }
  public require(name: string): RecommendationPolicy {
    const policy = this.get(name);
    if (!policy) throw new RangeError(`Recommendation policy not found: ${name.trim()}.`);
    return policy;
  }
  public toArray(): readonly RecommendationPolicy[] { return [...this.policies]; }
  public [Symbol.iterator](): Iterator<RecommendationPolicy> {
    return this.policies[Symbol.iterator]();
  }
}

function validatePolicies(policies: readonly RecommendationPolicy[]): void {
  const names = policies.map((policy) => {
    const name = requireText(policy.name);
    if (typeof policy.supports !== "function" || typeof policy.recommend !== "function") {
      throw new TypeError(`Recommendation policy "${name}" is invalid.`);
    }
    return name;
  });
  if (new Set(names).size !== names.length) {
    throw new RangeError("Recommendation policy names must be unique.");
  }
}

function requireText(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError("Recommendation policy name cannot be empty.");
  return normalized;
}
