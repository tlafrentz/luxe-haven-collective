import type { OutcomePolicy } from "./outcome-policy";

export class OutcomePolicyRegistry implements Iterable<OutcomePolicy> {
  private constructor(private readonly policies: readonly OutcomePolicy[]) {
    const names = policies.map(validate); if (new Set(names).size !== names.length) throw new RangeError("Outcome policy names must be unique.");
    this.policies = Object.freeze([...policies]);
  }
  public static empty(): OutcomePolicyRegistry { return new OutcomePolicyRegistry([]); }
  public static create(policies: readonly OutcomePolicy[]): OutcomePolicyRegistry { return new OutcomePolicyRegistry(policies); }
  public get size(): number { return this.policies.length; }
  public register(policy: OutcomePolicy): OutcomePolicyRegistry { return new OutcomePolicyRegistry([...this.policies, policy]); }
  public get(name: string): OutcomePolicy | undefined { const normalized = name.trim(); if (!normalized) throw new TypeError("Outcome policy name cannot be empty."); return this.policies.find((value) => value.name.trim() === normalized); }
  public require(name: string): OutcomePolicy { const value = this.get(name); if (!value) throw new RangeError(`Outcome policy not found: ${name.trim()}.`); return value; }
  public toArray(): readonly OutcomePolicy[] { return [...this.policies]; }
  public [Symbol.iterator](): Iterator<OutcomePolicy> { return this.policies[Symbol.iterator](); }
}
function validate(policy: OutcomePolicy): string { const name = policy.name.trim(); if (!name) throw new TypeError("Outcome policy name cannot be empty."); if (typeof policy.supports !== "function" || typeof policy.measure !== "function") throw new TypeError(`Outcome policy "${name}" is invalid.`); return name; }
