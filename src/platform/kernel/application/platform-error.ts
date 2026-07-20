export type PlatformErrorMetadata = Readonly<
  Record<string, unknown>
>;

export type PlatformErrorOptions = Readonly<{
  cause?: unknown;
  metadata?: PlatformErrorMetadata;
}>;

/**
 * Base error for stable platform-level failures.
 *
 * Platform errors add a machine-readable code and optional structured
 * metadata while retaining native Error behavior.
 */
export class PlatformError extends Error {
  public readonly code: string;
  public readonly metadata?: PlatformErrorMetadata;

  public constructor(
    code: string,
    message: string,
    options: PlatformErrorOptions = {},
  ) {
    super(message, { cause: options.cause });

    if (code.trim().length === 0) {
      throw new TypeError("Platform error code cannot be empty.");
    }

    this.name = new.target.name;
    this.code = code;
    this.metadata = options.metadata
      ? Object.freeze({ ...options.metadata })
      : undefined;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
