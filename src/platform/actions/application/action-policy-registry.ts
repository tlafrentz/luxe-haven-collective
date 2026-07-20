import type { ActionPolicy } from "./action-policy";

export class ActionPolicyRegistry implements Iterable<ActionPolicy> {
  private constructor(private readonly policies: readonly ActionPolicy[]) {
    const names = policies.map(validate);
    if (new Set(names).size !== names.length) throw new RangeError("Action policy names must be unique.");
    this.policies = Object.freeze([...policies]);
  }
  public static empty(): ActionPolicyRegistry { return new ActionPolicyRegistry([]); }
  public static create(policies: readonly ActionPolicy[]): ActionPolicyRegistry { return new ActionPolicyRegistry(policies); }
  public get size(): number { return this.policies.length; }
  public register(policy: ActionPolicy): ActionPolicyRegistry { return new ActionPolicyRegistry([...this.policies, policy]); }
  public get(name: string): ActionPolicy | undefined {
    const normalized = name.trim();
    if (!normalized) throw new TypeError("Action policy name cannot be empty.");
    return this.policies.find((policy) => policy.name.trim() === normalized);
  }
  public require(name: string): ActionPolicy {
    const policy = this.get(name);
    if (!policy) throw new RangeError(`Action policy not found: ${name.trim()}.`);
    return policy;
  }
  public toArray(): readonly ActionPolicy[] { return [...this.policies]; }
  public [Symbol.iterator](): Iterator<ActionPolicy> { return this.policies[Symbol.iterator](); }
}
function validate(policy: ActionPolicy): string {
  const name = policy.name.trim();
  if (!name) throw new TypeError("Action policy name cannot be empty.");
  if (typeof policy.supports !== "function" || typeof policy.create !== "function") {
    throw new TypeError(`Action policy "${name}" is invalid.`);
  }
  return name;
}
