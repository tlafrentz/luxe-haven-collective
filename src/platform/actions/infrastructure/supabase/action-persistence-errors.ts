import { PlatformError } from "../../../kernel";
export class PlatformActionPersistenceError extends PlatformError {
  public constructor(message: string, options: Readonly<{ cause?: unknown; metadata?: Readonly<Record<string, unknown>> }> = {}) { super("PLATFORM_ACTION_PERSISTENCE_ERROR", message, options); Object.freeze(this); }
}
export class StalePlatformActionVersion extends PlatformError {
  public constructor(actionId: string, expectedVersion: number, options: Readonly<{ cause?: unknown }> = {}) { super("STALE_PLATFORM_ACTION_VERSION", "Platform Action was changed by another writer.", { cause: options.cause, metadata: { actionId, expectedVersion } }); Object.freeze(this); }
}
