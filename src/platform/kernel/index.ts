export { Entity } from "./domain/entity";
export {
  EntityWithProps,
} from "./domain/entity-with-props";
export { Identifier } from "./domain/identifier";
export { Money } from "./domain/money";
export { Percentage } from "./domain/percentage";
export { ValueObject } from "./domain/value-object";

export {
  PlatformError,
  type PlatformErrorMetadata,
  type PlatformErrorOptions,
} from "./application/platform-error";

export {
  Result,
  type Failure,
  type Result as ResultType,
  type Success,
} from "./application/result";
