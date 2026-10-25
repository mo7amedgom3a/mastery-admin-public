const API_PREFIX = "/api/v1";

/**
 * Everything goes same-origin: the dev server proxies `/api` to the backend, and in production
 * the admin app is served behind a reverse proxy on the backend's domain. This is what makes the
 * backend's httpOnly admin cookies (`b2c_admin_access_token` / `b2c_admin_refresh_token`) work.
 */

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue | QueryValue[]>;
type PathParams = Record<string, string | number>;

export type ApiRequestOptions = Omit<RequestInit, "body" | "headers" | "method"> & {
  body?: unknown;
  headers?: HeadersInit;
  path?: PathParams;
  query?: QueryParams;
  /** Next fetch-cache hint; ignored here, kept so service signatures can be copied across. */
  next?: never;
};

export type ApiErrorBody = {
  detail?: unknown;
  [key: string]: unknown;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details: {
      body?: ApiErrorBody | string;
      detail?: unknown;
      requestId?: string | null;
      url?: string;
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Registered by the auth store: called once when a non-auth request gets a 401, to refresh the
 * admin session. Return `true` to have the request retried with the rotated cookie.
 */
let unauthorizedHandler: (() => Promise<boolean>) | null = null;

export function setUnauthorizedHandler(handler: (() => Promise<boolean>) | null): void {
  unauthorizedHandler = handler;
}

/** Session endpoints drive their own refresh; auto-retrying them would recurse. */
function canRecover(path: string): boolean {
  return !path.startsWith("admin/auth/");
}

export async function apiRequest<T>(method: string, path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, headers: requestHeaders, path: pathParams, query, ...requestOptions } = options;
  const headers = buildHeaders(requestHeaders);
  const url = buildUrl(path, pathParams, query);

  if (body !== undefined && !isFormData(body) && !isBlob(body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }


  const send = () =>
    fetch(url, {
      ...requestOptions,
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : serializeBody(body),
    });

  let response = await send();

  if (response.status === 401 && canRecover(path) && unauthorizedHandler) {
    const refreshed = await unauthorizedHandler().catch(() => false);
    if (refreshed) {
      response = await send();
    }
  }

  if (!response.ok) {
    throw await createApiError(response, url);
  }

  if (response.status === 204 || !hasJsonBody(response)) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function apiGet<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>("GET", path, options);
}

export function apiPost<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>("POST", path, options);
}

export function apiPut<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>("PUT", path, options);
}

export function apiPatch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>("PATCH", path, options);
}

export function apiDelete<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>("DELETE", path, options);
}

function buildHeaders(headers: HeadersInit | undefined): Headers {
  const builtHeaders = new Headers(headers);

  const requestId = createRequestId();
  if (requestId) {
    builtHeaders.set("X-Request-ID", requestId);
  }

  return builtHeaders;
}

function createRequestId(): string | undefined {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return undefined;
}

function buildUrl(path: string, pathParams: PathParams | undefined, query: QueryParams | undefined): string {
  const url = new URL(normalizePath(interpolatePath(path, pathParams)), "http://app.invalid");

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      appendQueryParam(url, key, value);
    }
  }

  return `${url.pathname}${url.search}`;
}

function normalizePath(path: string): string {
  const pathWithSlash = path.startsWith("/") ? path : `/${path}`;
  if (pathWithSlash.startsWith(`${API_PREFIX}/`)) {
    return pathWithSlash;
  }
  return `${API_PREFIX}${pathWithSlash}`;
}

function interpolatePath(path: string, pathParams: PathParams | undefined): string {
  if (!pathParams) {
    return path;
  }

  return path.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = pathParams[key];

    if (value === undefined) {
      throw new Error(`Missing path parameter: ${key}`);
    }

    return encodeURIComponent(String(value));
  });
}

function appendQueryParam(url: URL, key: string, value: QueryValue | QueryValue[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      appendQueryParam(url, key, item);
    }
    return;
  }

  if (value === undefined || value === null) {
    return;
  }

  url.searchParams.append(key, String(value));
}

function serializeBody(body: unknown): BodyInit {
  if (isFormData(body) || isBlob(body)) return body as BodyInit;
  return JSON.stringify(body);
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}


function hasJsonBody(response: Response): boolean {
  return response.headers.get("Content-Type")?.includes("application/json") ?? false;
}

async function createApiError(response: Response, url: string): Promise<ApiError> {
  const body = await parseErrorBody(response);
  const detail = typeof body === "object" && body !== null ? body.detail : undefined;
  const message = typeof detail === "string" ? detail : `API request failed: ${response.status}`;

  return new ApiError(response.status, message, {
    body,
    detail,
    requestId: response.headers.get("X-Request-ID"),
    url,
  });
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody | string | undefined> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as ApiErrorBody;
  } catch {
    return text;
  }
}
