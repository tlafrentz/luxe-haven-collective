/**
 * Base class for immutable domain value objects.
 *
 * Value objects are defined by their attributes rather than an independent
 * identity. Two value objects are equal when they are instances of the same
 * concrete value-object class and contain structurally equal properties.
 *
 * @typeParam TProps - The immutable properties that define the value object.
 */
export abstract class ValueObject<
  TProps extends Readonly<Record<string, unknown>>,
> {
  protected readonly props: TProps;

  protected constructor(props: TProps) {
    this.props = deepFreeze(copyValue(props));
    Object.freeze(this);
  }

  /**
   * Compares this value object with an unknown value.
   *
   * Equality requires both values to share the same concrete constructor and
   * contain structurally equal properties.
   */
  public equals(other: unknown): boolean {
    if (other === this) {
      return true;
    }

    if (!(other instanceof ValueObject)) {
      return false;
    }

    if (this.constructor !== other.constructor) {
      return false;
    }

    return structuralEquals(this.props, other.props);
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
      Object.entries(value).map(([key, entry]) => [key, copyValue(entry)]),
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

  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }

  return Object.freeze(value);
}

function structuralEquals(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (left instanceof Date || right instanceof Date) {
    return (
      left instanceof Date &&
      right instanceof Date &&
      left.getTime() === right.getTime()
    );
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => structuralEquals(entry, right[index]))
    );
  }

  if (!isPlainObject(left) || !isPlainObject(right)) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right, key) &&
      structuralEquals(left[key], right[key]),
  );
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}
