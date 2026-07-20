import type { AutomationPolicy } from "./automation-policy";

export class AutomationPolicyRegistry implements Iterable<AutomationPolicy> {
  private constructor(private readonly policies: readonly AutomationPolicy[]) {
    const names = policies.map(validate);
    if (new Set(names).size !== names.length) throw new RangeError("Automation policy names must be unique.");
    this.policies = Object.freeze([...policies]);
  }
  public static empty(): AutomationPolicyRegistry { return new AutomationPolicyRegistry([]); }
  public static create(policies: readonly AutomationPolicy[]): AutomationPolicyRegistry { return new AutomationPolicyRegistry(policies); }
  public get size(): number { return this.policies.length; }
  public register(policy: AutomationPolicy): AutomationPolicyRegistry { return new AutomationPolicyRegistry([...this.policies, policy]); }
  public get(name: string): AutomationPolicy | undefined { const normalized = name.trim(); if (!normalized) throw new TypeError("Automation policy name cannot be empty."); return this.policies.find((value) => value.name.trim() === normalized); }
  public require(name: string): AutomationPolicy { const value = this.get(name); if (!value) throw new RangeError(`Automation policy not found: ${name.trim()}.`); return value; }
  public toArray(): readonly AutomationPolicy[] { return [...this.policies]; }
  public [Symbol.iterator](): Iterator<AutomationPolicy> { return this.policies[Symbol.iterator](); }
}
function validate(policy: AutomationPolicy): string {
  const name = policy.name.trim();
  if (!name) throw new TypeError("Automation policy name cannot be empty.");
  if (typeof policy.supports !== "function" || typeof policy.govern !== "function") throw new TypeError(`Automation policy "${name}" is invalid.`);
  return name;
}
