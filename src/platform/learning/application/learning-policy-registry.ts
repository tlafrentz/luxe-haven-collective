import type { LearningPolicy } from "./learning-policy";

export class LearningPolicyRegistry implements Iterable<LearningPolicy> {
  private constructor(private readonly policies: readonly LearningPolicy[]) { const names = policies.map(validate); if (new Set(names).size !== names.length) throw new RangeError("Learning policy names must be unique."); this.policies = Object.freeze([...policies]); }
  public static empty(): LearningPolicyRegistry { return new LearningPolicyRegistry([]); }
  public static create(policies: readonly LearningPolicy[]): LearningPolicyRegistry { return new LearningPolicyRegistry(policies); }
  public get size(): number { return this.policies.length; }
  public register(policy: LearningPolicy): LearningPolicyRegistry { return new LearningPolicyRegistry([...this.policies, policy]); }
  public get(name: string): LearningPolicy | undefined { const normalized = name.trim(); if (!normalized) throw new TypeError("Learning policy name cannot be empty."); return this.policies.find((value) => value.name.trim() === normalized); }
  public require(name: string): LearningPolicy { const value = this.get(name); if (!value) throw new RangeError(`Learning policy not found: ${name.trim()}.`); return value; }
  public toArray(): readonly LearningPolicy[] { return [...this.policies]; } public [Symbol.iterator](): Iterator<LearningPolicy> { return this.policies[Symbol.iterator](); }
}
function validate(policy: LearningPolicy): string { const name = policy.name.trim(); if (!name) throw new TypeError("Learning policy name cannot be empty."); if (typeof policy.supports !== "function" || typeof policy.learn !== "function") throw new TypeError(`Learning policy "${name}" is invalid.`); return name; }
