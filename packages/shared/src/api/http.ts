/**
 * Shared URL + fetch helpers for web (same-origin) and desktop (absolute apiOrigin).
 * Mirrors the contract used by useSessionStream / useSessionEdits.
 */

export type GetRequestHeaders = () => Promise<Record<string, string>>;

/** When apiOrigin is empty/undefined, path is used as-is (relative, same-origin in browser). */
export function joinApiOrigin(apiOrigin: string | undefined, path: string): string {
  const base = (apiOrigin ?? "").replace(/\/$/, "");
  return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : path;
}

export async function mergeRequestHeaders(
  getRequestHeaders?: GetRequestHeaders
): Promise<Record<string, string>> {
  if (!getRequestHeaders) return {};
  return { ...(await getRequestHeaders()) };
}

export type ApiFetchOptions = RequestInit & {
  apiOrigin?: string;
  path: string;
  getRequestHeaders?: GetRequestHeaders;
};

/** Low-level fetch with joined URL and merged auth headers. */
export async function apiFetch(options: ApiFetchOptions): Promise<Response> {
  const { apiOrigin, path, getRequestHeaders, headers: initHeaders, ...rest } = options;
  const url = joinApiOrigin(apiOrigin, path);
  const merged = await mergeRequestHeaders(getRequestHeaders);
  const headers = new Headers(merged);
  if (initHeaders) {
    const extra = new Headers(initHeaders);
    extra.forEach((v, k) => headers.set(k, v));
  }
  return fetch(url, { ...rest, headers });
}

export async function apiGetJson<T>(
  apiOrigin: string | undefined,
  path: string,
  getRequestHeaders?: GetRequestHeaders
): Promise<T> {
  const res = await apiFetch({
    apiOrigin,
    path,
    getRequestHeaders,
    method: "GET",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `GET ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function apiPostJson<TBody extends Record<string, unknown>, TRes>(
  apiOrigin: string | undefined,
  path: string,
  body: TBody,
  getRequestHeaders?: GetRequestHeaders
): Promise<TRes> {
  const res = await apiFetch({
    apiOrigin,
    path,
    getRequestHeaders,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `POST ${path} failed (${res.status})`);
  }
  return res.json() as Promise<TRes>;
}

export async function apiPatchJson<TBody extends Record<string, unknown>, TRes>(
  apiOrigin: string | undefined,
  path: string,
  body: TBody,
  getRequestHeaders?: GetRequestHeaders
): Promise<TRes> {
  const res = await apiFetch({
    apiOrigin,
    path,
    getRequestHeaders,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `PATCH ${path} failed (${res.status})`);
  }
  return res.json() as Promise<TRes>;
}
