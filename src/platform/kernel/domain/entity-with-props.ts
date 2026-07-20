import { Entity } from "./entity";
import { Identifier } from "./identifier";

/**
 * Base class for immutable domain entities that own state in addition to
 * identity.
 *
 * EntityWithProps deliberately does not imply Aggregate Root semantics.
 * It provides immutable property storage for entities whose behavior depends
 * on both identity and state.
 *
 * @typeParam TProps - The immutable properties owned by the entity.
 * @typeParam TId - The identifier type used by the entity.
 */
export abstract class EntityWithProps<
  TProps extends Readonly<Record<string, unknown>>,
  TId extends Identifier = Identifier,
> extends Entity<TId> {
  protected readonly props: TProps;

  protected constructor(
    id: TId,
    props: TProps,
  ) {
    super(id);
    this.props = deepFreeze(copyValue(props));
    Object.freeze(this);
  }
}

function copyValue<T>(value: T): T {
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (Array.isArray(value)) {
    return value.map(copyValue) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        copyValue(entry),
      ]),
    ) as T;
  }

  return value;
}

function deepFreeze<T>(value: T): T {
  if (
    value === null ||
    typeof value !== "object" ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  for (
    const entry of Object.values(
      value as Record<string, unknown>,
    )
  ) {
    deepFreeze(entry);
  }

  return Object.freeze(value);
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}
