const DEFAULT_HOSPITABLE_API_BASE_URL =
  "https://public.api.hospitable.com/v2";

const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const MAX_ERROR_RESPONSE_LENGTH = 500;

type HospitableRequestOptions = {
  method?: "GET";
  searchParams?: Record<
    string,
    string | number | boolean | undefined
  >;
  timeoutMs?: number;
};

export class HospitableApiError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor({
    message,
    status,
    retryable,
  }: {
    message: string;
    status: number;
    retryable: boolean;
  }) {
    super(message);
    this.name = "HospitableApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

function getHospitableConfig() {
  const token = process.env.HOSPITABLE_API_TOKEN;
  const configuredBaseUrl =
    process.env.HOSPITABLE_API_BASE_URL ??
    DEFAULT_HOSPITABLE_API_BASE_URL;

  if (!token) {
    throw new Error(
      "Hospitable integration is not configured.",
    );
  }

  let baseUrl: URL;

  try {
    baseUrl = new URL(configuredBaseUrl);
  } catch {
    throw new Error(
      "Hospitable integration has an invalid API URL.",
    );
  }

  if (baseUrl.protocol !== "https:") {
    throw new Error(
      "Hospitable integration requires an HTTPS API URL.",
    );
  }

  return {
    token,
    baseUrl: baseUrl.toString(),
  };
}

function buildUrl({
  baseUrl,
  path,
  searchParams,
}: {
  baseUrl: string;
  path: string;
  searchParams?: HospitableRequestOptions["searchParams"];
}): URL {
  const normalizedBaseUrl =
    baseUrl.endsWith("/")
      ? baseUrl
      : `${baseUrl}/`;

  const normalizedPath =
    path.startsWith("/")
      ? path.slice(1)
      : path;

  const url = new URL(
    normalizedPath,
    normalizedBaseUrl,
  );

  for (const [key, value] of Object.entries(
    searchParams ?? {},
  )) {
    if (value === undefined) {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url;
}

function isRetryableStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 429 ||
    status >= 500
  );
}

async function readErrorResponse(
  response: Response,
): Promise<string | null> {
  try {
    const responseText = await response.text();

    if (!responseText) {
      return null;
    }

    return responseText
      .replace(/\s+/g, " ")
      .slice(0, MAX_ERROR_RESPONSE_LENGTH);
  } catch {
    return null;
  }
}

export async function hospitableRequest<T>(
  path: string,
  options: HospitableRequestOptions = {},
): Promise<T> {
  const { token, baseUrl } =
    getHospitableConfig();

  const url = buildUrl({
    baseUrl,
    path,
    searchParams: options.searchParams,
  });

  const timeoutMs =
    options.timeoutMs ??
    DEFAULT_REQUEST_TIMEOUT_MS;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const providerMessage =
        await readErrorResponse(response);

      console.error(
        "Hospitable API request failed",
        {
          path,
          status: response.status,
          providerMessage,
        },
      );

      throw new HospitableApiError({
        message:
          response.status === 429
            ? "Hospitable temporarily rate-limited the sync."
            : "Hospitable could not complete the requested operation.",
        status: response.status,
        retryable: isRetryableStatus(
          response.status,
        ),
      });
    }

    return (await response.json()) as T;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new HospitableApiError({
        message:
          "Hospitable did not respond before the request timed out.",
        status: 504,
        retryable: true,
      });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
