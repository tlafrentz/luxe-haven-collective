/**
 * Immutable success result.
 */
export type Success<TValue> = Readonly<{
  isSuccess: true;
  isFailure: false;
  value: TValue;
}>;

/**
 * Immutable failure result.
 */
export type Failure<TError> = Readonly<{
  isSuccess: false;
  isFailure: true;
  error: TError;
}>;

/**
 * Discriminated result of an operation that may succeed or fail.
 */
export type Result<TValue, TError> =
  | Success<TValue>
  | Failure<TError>;

export const Result = Object.freeze({
  ok<TValue>(value: TValue): Result<TValue, never> {
    return Object.freeze({
      isSuccess: true,
      isFailure: false,
      value,
    });
  },

  fail<TError>(error: TError): Result<never, TError> {
    return Object.freeze({
      isSuccess: false,
      isFailure: true,
      error,
    });
  },

  map<TValue, TError, TNext>(
    result: Result<TValue, TError>,
    transform: (value: TValue) => TNext,
  ): Result<TNext, TError> {
    return result.isSuccess
      ? Result.ok(transform(result.value))
      : result;
  },

  mapError<TValue, TError, TNextError>(
    result: Result<TValue, TError>,
    transform: (error: TError) => TNextError,
  ): Result<TValue, TNextError> {
    return result.isFailure
      ? Result.fail(transform(result.error))
      : result;
  },

  flatMap<TValue, TError, TNext, TNextError>(
    result: Result<TValue, TError>,
    transform: (
      value: TValue,
    ) => Result<TNext, TNextError>,
  ): Result<TNext, TError | TNextError> {
    return result.isSuccess ? transform(result.value) : result;
  },

  match<TValue, TError, TOutput>(
    result: Result<TValue, TError>,
    handlers: Readonly<{
      ok: (value: TValue) => TOutput;
      fail: (error: TError) => TOutput;
    }>,
  ): TOutput {
    return result.isSuccess
      ? handlers.ok(result.value)
      : handlers.fail(result.error);
  },

  getOrElse<TValue, TError>(
    result: Result<TValue, TError>,
    fallback: TValue | ((error: TError) => TValue),
  ): TValue {
    if (result.isSuccess) {
      return result.value;
    }

    return typeof fallback === "function"
      ? (fallback as (error: TError) => TValue)(result.error)
      : fallback;
  },
});
