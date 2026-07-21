import { PlatformError } from "../../kernel";

export class PlatformActionNotFound extends PlatformError {
  public constructor(actionId: string, workspaceId: string) {
    super("PLATFORM_ACTION_NOT_FOUND", "Platform Action was not found in the requested workspace.", { metadata: { actionId, workspaceId } });
    Object.freeze(this);
  }
}

export class PlatformActionWorkspaceMismatch extends PlatformError {
  public constructor(actionId: string, expectedWorkspaceId: string, actualWorkspaceId: string) {
    super("PLATFORM_ACTION_WORKSPACE_MISMATCH", "Platform Action belongs to a different workspace.", { metadata: { actionId, expectedWorkspaceId, actualWorkspaceId } });
    Object.freeze(this);
  }
}

export class StalePlatformActionVersion extends PlatformError {
  public constructor(actionId: string, expectedVersion: number, actualVersionOrOptions?: number | Readonly<{ cause?: unknown }>, options: Readonly<{ cause?: unknown }> = {}) {
    const actualVersion = typeof actualVersionOrOptions === "number" ? actualVersionOrOptions : undefined;
    const cause = typeof actualVersionOrOptions === "object" ? actualVersionOrOptions.cause : options.cause;
    super("STALE_PLATFORM_ACTION_VERSION", "Platform Action was changed by another writer.", { cause, metadata: { actionId, expectedVersion, ...(actualVersion === undefined ? {} : { actualVersion }) } });
    Object.freeze(this);
  }
}

export class PlatformActionPersistenceFailure extends PlatformError {
  public constructor(message: string, options: Readonly<{ cause?: unknown; metadata?: Readonly<Record<string, unknown>> }> = {}) {
    super("PLATFORM_ACTION_PERSISTENCE_FAILURE", message, options);
    Object.freeze(this);
  }
}

/** @deprecated Use PlatformActionPersistenceFailure. */
export { PlatformActionPersistenceFailure as PlatformActionPersistenceError };
