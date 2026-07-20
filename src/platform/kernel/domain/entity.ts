import { Identifier } from "./identifier";

/**
 * Base class for domain entities.
 *
 * Entities are defined by identity rather than all of their attributes.
 * Equality requires the same concrete entity type and an equal identifier.
 *
 * @typeParam TId - The identifier type used by the entity.
 */
export abstract class Entity<
  TId extends Identifier = Identifier,
> {
  public readonly id: TId;

  protected constructor(id: TId) {
    this.id = id;
  }

  public equals(other: unknown): boolean {
    if (other === this) {
      return true;
    }

    if (!(other instanceof Entity)) {
      return false;
    }

    return (
      this.constructor === other.constructor &&
      this.id.equals(other.id)
    );
  }
}
