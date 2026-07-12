const DEFAULT_HOSPITABLE_API_BASE_URL =
  "https://public.api.hospitable.com/v2";

type HospitableRequestOptions = {
  method?: "GET";
  searchParams?: Record<
    string,
    string | number | boolean | undefined
  >;
};

function getHospitableConfig() {
  const token = process.env.HOSPITABLE_API_TOKEN;

  const baseUrl =
    process.env.HOSPITABLE_API_BASE_URL ??
    DEFAULT_HOSPITABLE_API_BASE_URL;

  if (!token) {
    throw new Error(
      "HOSPITABLE_API_TOKEN is not configured.",
    );
  }

  return {
    token,
    baseUrl,
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

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      [
        `Hospitable API request failed with status ${response.status}.`,
        responseText || response.statusText,
      ].join(" "),
    );
  }

  return (await response.json()) as T;
}
