import type {
  ProviderError,
} from "./provider-error";

export interface ProviderSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export interface ProviderFailure {
  readonly ok: false;
  readonly error: ProviderError;
}

export type ProviderResult<T> =
  | ProviderSuccess<T>
  | ProviderFailure;

export function providerSuccess<T>(
  data: T,
): ProviderSuccess<T> {
  return {
    ok: true,
    data,
  };
}

export function providerFailure(
  error: ProviderError,
): ProviderFailure {
  return {
    ok: false,
    error,
  };
}

export function unwrapProviderResult<T>(
  result: ProviderResult<T>,
): T {
  if (!result.ok) {
    throw result.error;
  }

  return result.data;
}
