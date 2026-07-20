import type { DecisionPolicy } from "./decision-policy";

export class DecisionPolicyRegistry implements Iterable<DecisionPolicy> {
  private readonly policies: readonly DecisionPolicy[];

  private constructor(policies: readonly DecisionPolicy[]) {
    const names = policies.map(validatePolicy);
    if (new Set(names).size !== names.length) {
      throw new RangeError("Decision policy names must be unique.");
    }
    this.policies = Object.freeze([...policies]);
  }

  public static empty(): DecisionPolicyRegistry { return new DecisionPolicyRegistry([]); }
  public static create(policies: readonly DecisionPolicy[]): DecisionPolicyRegistry {
    return new DecisionPolicyRegistry(policies);
  }
  public get size(): number { return this.policies.length; }
  public register(policy: DecisionPolicy): DecisionPolicyRegistry {
    return new DecisionPolicyRegistry([...this.policies, policy]);
  }
  public get(name: string): DecisionPolicy | undefined {
    const normalized = requireName(name);
    return this.policies.find((policy) => policy.name.trim() === normalized);
  }
  public require(name: string): DecisionPolicy {
    const policy = this.get(name);
    if (!policy) throw new RangeError(`Decision policy not found: ${name.trim()}.`);
    return policy;
  }
  public toArray(): readonly DecisionPolicy[] { return [...this.policies]; }
  public [Symbol.iterator](): Iterator<DecisionPolicy> { return this.policies[Symbol.iterator](); }
}

function validatePolicy(policy: DecisionPolicy): string {
  const name = requireName(policy.name);
  if (typeof policy.supports !== "function" || typeof policy.decide !== "function") {
    throw new TypeError(`Decision policy "${name}" is invalid.`);
  }
  return name;
}

function requireName(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError("Decision policy name cannot be empty.");
  return normalized;
}
