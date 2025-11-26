/*
  API service layer for broiler.dev
  Base URL: https://api.broiler.dev/prod
  Provides: Auth (GitHub), token handling, user retrieval, simple event emitter for auth state.
  NOTE: Data models are placeholders and can be refined later.
*/

export const API_BASE_URL = 'https://api.broiler.dev/prod';

// Generic GET wrapper
export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include'
  });

  if (!res.ok) { 
    throw new Error(`GET ${path} failed: ${res.status}`);
  }

  return res.json();
}

// Generic POST wrapper
export async function apiPost<T = unknown>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) { 
    throw new Error(`POST ${path} failed: ${res.status}`);
  }

  return res.json();
}