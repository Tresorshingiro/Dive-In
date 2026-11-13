const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Auth endpoints never trigger a silent refresh (avoids loops). */
const NO_REFRESH = ['/auth/login', '/auth/admin/login', '/auth/register', '/auth/refresh', '/auth/logout'];

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, shared by every request that got a 401. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/** Owners with several gyms pick one; gym-portal calls carry it. The server re-checks ownership. */
const GYM_KEY = 'dive.gymId';
export const selectedGym = {
  get: () => {
    try {
      return localStorage.getItem(GYM_KEY);
    } catch {
      return null;
    }
  },
  set: (id: string | null) => {
    try {
      if (id) localStorage.setItem(GYM_KEY, id);
      else localStorage.removeItem(GYM_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

export async function api<T>(path: string, opts: Options = {}, retried = false): Promise<T> {
  const gymId = path.startsWith('/gym/') ? selectedGym.get() : null;
  const isBlob = opts.body instanceof Blob;
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    credentials: 'include',
    signal: opts.signal,
    headers: {
      ...(opts.body !== undefined && !isBlob ? { 'Content-Type': 'application/json' } : {}),
      ...(isBlob ? { 'Content-Type': (opts.body as Blob).type } : {}),
      ...(gymId ? { 'X-Gym-Id': gymId } : {}),
      ...opts.headers,
    },
    body: opts.body === undefined ? undefined : isBlob ? (opts.body as Blob) : JSON.stringify(opts.body),
  });

  if (res.status === 401 && !retried && !NO_REFRESH.includes(path)) {
    if (await refreshSession()) return api<T>(path, opts, true);
  }

  if (!res.ok) {
    let payload: { error?: { code?: string; message?: string; fields?: Record<string, string> } } = {};
    try {
      payload = await res.json();
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(
      res.status,
      payload.error?.code ?? 'HTTP_ERROR',
      payload.error?.message ?? (res.status >= 500 ? 'The server is unavailable. Is the API running?' : 'Request failed'),
      payload.error?.fields,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
