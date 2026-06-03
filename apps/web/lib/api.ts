'use client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

type RequestOptions = RequestInit & {
  withCsrf?: boolean;
};

function getCsrfToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem('csrf_token');
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const withCsrf = options.withCsrf ?? true;
  const headers = new Headers(options.headers);
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && !headers.get('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (withCsrf) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers.set('x-csrf-token', csrf);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      (payload as { message?: string })?.message ??
      `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

export function setCsrfToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem('csrf_token', token);
}

export function clearCsrfToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem('csrf_token');
}
