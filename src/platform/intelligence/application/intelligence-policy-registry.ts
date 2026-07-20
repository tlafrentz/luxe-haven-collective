import type { IntelligencePolicy } from "./intelligence-policy";

export class IntelligencePolicyRegistry implements Iterable<IntelligencePolicy> {
  private constructor(private readonly policies: readonly IntelligencePolicy[]) {
    const names = policies.map(validate); if (new Set(names).size !== names.length) throw new RangeError("Intelligence policy names must be unique.");
    this.policies = Object.freeze([...policies]);
  }
  public static empty(): IntelligencePolicyRegistry { return new IntelligencePolicyRegistry([]); }
  public static create(policies: readonly IntelligencePolicy[]): IntelligencePolicyRegistry { return new IntelligencePolicyRegistry(policies); }
  public get size(): number { return this.policies.length; }
  public register(policy: IntelligencePolicy): IntelligencePolicyRegistry { return new IntelligencePolicyRegistry([...this.policies, policy]); }
  public get(name: string): IntelligencePolicy | undefined { const normalized = name.trim(); if (!normalized) throw new TypeError("Intelligence policy name cannot be empty."); return this.policies.find((value) => value.name.trim() === normalized); }
  public require(name: string): IntelligencePolicy { const value = this.get(name); if (!value) throw new RangeError(`Intelligence policy not found: ${name.trim()}.`); return value; }
  public toArray(): readonly IntelligencePolicy[] { return [...this.policies]; }
  public [Symbol.iterator](): Iterator<IntelligencePolicy> { return this.policies[Symbol.iterator](); }
}
function validate(policy: IntelligencePolicy): string { const name = policy.name.trim(); if (!name) throw new TypeError("Intelligence policy name cannot be empty."); if (typeof policy.supports !== "function" || typeof policy.analyze !== "function") throw new TypeError(`Intelligence policy "${name}" is invalid.`); return name; }
