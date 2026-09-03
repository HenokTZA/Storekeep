import { cacheGet, cacheSet } from './database';
import { secureDelete, secureGet, secureSet } from './storage';

const configuredUrl = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';
export const API_URL = configuredUrl.replace(/\/$/, '');

const ACCESS_KEY = 'storeledger.access';
const REFRESH_KEY = 'storeledger.refresh';
const STORE_KEY = 'storeledger.store';

export class ApiError extends Error {
  constructor(public status: number, public details: unknown) {
    super(typeof details === 'string' ? details : 'The request could not be completed.');
  }
}

export async function saveTokens(access: string, refresh: string) {
  await Promise.all([
    secureSet(ACCESS_KEY, access),
    secureSet(REFRESH_KEY, refresh),
  ]);
}

export async function clearSession() {
  await Promise.all([
    secureDelete(ACCESS_KEY),
    secureDelete(REFRESH_KEY),
    secureDelete(STORE_KEY),
  ]);
}

export async function setActiveStore(storeId: number) {
  await secureSet(STORE_KEY, String(storeId));
}

export async function getAuthHeaders() {
  const [access, storeId] = await Promise.all([
    secureGet(ACCESS_KEY),
    secureGet(STORE_KEY),
  ]);
  return {
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
    ...(storeId ? { 'X-Store-ID': storeId } : {}),
  };
}

async function parseResponse(response: Response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error?.details || payload || response.statusText);
  }
  return payload;
}

async function refreshAccessToken() {
  const refresh = await secureGet(REFRESH_KEY);
  if (!refresh) return null;
  const response = await fetch(`${API_URL}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) return null;
  const payload = await response.json();
  await saveTokens(payload.access, payload.refresh || refresh);
  return payload.access as string;
}

export async function login(username: string, password: string) {
  const response = await fetch(`${API_URL}/auth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const payload = await parseResponse(response);
  await saveTokens(payload.access, payload.refresh);
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const [access, storeId] = await Promise.all([
    secureGet(ACCESS_KEY),
    secureGet(STORE_KEY),
  ]);
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (access) headers.set('Authorization', `Bearer ${access}`);
  if (storeId) headers.set('X-Store-ID', storeId);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401 && retry) {
    const nextAccess = await refreshAccessToken();
    if (nextAccess) return apiFetch<T>(path, options, false);
  }
  return (await parseResponse(response)) as T;
}

export async function cachedGet<T>(path: string): Promise<{ data: T; offline: boolean }> {
  try {
    const data = await apiFetch<T>(path);
    await cacheSet(path, data);
    return { data, offline: false };
  } catch (error) {
    const cached = await cacheGet<T>(path);
    if (cached) return { data: cached, offline: true };
    throw error;
  }
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (typeof error.details === 'string') return error.details;
    const details = error.details as Record<string, unknown>;
    const first = details && Object.values(details)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === 'string') return first;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
