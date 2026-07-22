import { InvalidActionVersion } from "./action-errors";

export class ActionVersion {
  private constructor(public readonly value: number) { Object.freeze(this); }
  public static initial(): ActionVersion { return new ActionVersion(1); }
  public static create(value: number): ActionVersion {
    if (!Number.isInteger(value) || value <= 0) throw new InvalidActionVersion(value);
    return new ActionVersion(value);
  }
  public next(): ActionVersion { return ActionVersion.create(this.value + 1); }
  public equals(other: ActionVersion): boolean { return this.value === other.value; }
  public toJSON(): number { return this.value; }
}
