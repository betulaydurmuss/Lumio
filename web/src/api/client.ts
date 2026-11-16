import { CSRF_HEADER } from '@lumio/shared';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

let csrfReady: Promise<void> | undefined;

/** Makes sure the CSRF cookie exists before the first write. */
function ensureCsrf(): Promise<void> {
  if (readCookie('lumio_csrf')) return Promise.resolve();
  csrfReady ??= fetch('/api/auth/csrf', { credentials: 'same-origin' }).then(() => {
    csrfReady = undefined;
  });
  return csrfReady;
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') {
    await ensureCsrf();
    headers[CSRF_HEADER] = readCookie('lumio_csrf') ?? '';
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

let refreshing: Promise<boolean> | undefined;

/** One refresh at a time, however many requests hit an expired access token together. */
function refreshSession(): Promise<boolean> {
  refreshing ??= send('POST', '/api/auth/refresh')
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = undefined;
    });
  return refreshing;
}

const NO_REFRESH = new Set(['/api/auth/login', '/api/auth/login/totp', '/api/auth/refresh']);

export async function api<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options: { body?: unknown; schema?: z.ZodType<T> } = {},
): Promise<T> {
  let res = await send(method, path, options.body);
  if (res.status === 401 && !NO_REFRESH.has(path) && (await refreshSession())) {
    res = await send(method, path, options.body);
  }
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      res.status,
      payload?.error?.code ?? 'unknown',
      payload?.error?.message ?? res.statusText,
    );
  }
  if (res.status === 204) return undefined as T;
  const json: unknown = await res.json();
  return options.schema ? options.schema.parse(json) : (json as T);
}
