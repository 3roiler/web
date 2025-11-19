/*
  API service layer for broiler.dev
  Base URL: https://api.broiler.dev/prod
  Provides: Auth (GitHub), token handling, user retrieval, simple event emitter for auth state.
  NOTE: Data models are placeholders and can be refined later.
*/

export const API_BASE_URL = 'https://api.broiler.dev/prod';

// Placeholder data models (adjust later)
export interface AuthToken {
  accessToken?: string; // actual token string
  tokenType?: string;   // e.g. 'Bearer'
  refreshToken?: string;
  expiresAt?: string;   // ISO timestamp
}

export interface User {
  id?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
  // Extend with roles, permissions, etc.
}

// --- Internal state ---
let authToken: AuthToken | null = null;
let currentUser: User | null = null;

// Simple pub-sub for auth changes
const authListeners = new Set<(isAuthed: boolean, user: User | null) => void>();

function notifyAuth() {
  const isAuthed = !!authToken?.accessToken;
  for (const fn of authListeners) fn(isAuthed, currentUser);
}

export function onAuthChange(listener: (isAuthed: boolean, user: User | null) => void): () => void {
  authListeners.add(listener);
  // immediate fire for initial state
  listener(!!authToken?.accessToken, currentUser);
  return () => authListeners.delete(listener);
}

// --- Token persistence ---
const TOKEN_STORAGE_KEY = 'broiler.auth.token';

function loadTokenFromStorage() {
  if (authToken) return; // already loaded
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (raw) authToken = JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse stored auth token', e);
  }
}

function persistToken() {
  if (!authToken) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(authToken));
}

// --- Public helpers ---
export function isAuthenticated(): boolean {
  loadTokenFromStorage();
  return !!authToken?.accessToken;
}

export function getToken(): AuthToken | null {
  loadTokenFromStorage();
  return authToken;
}

export async function getCurrentUser(force = false): Promise<User | null> {
  if (!isAuthenticated()) return null;
  if (currentUser && !force) return currentUser;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      credentials: 'include',
      headers: authHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch user');
    currentUser = await res.json();
    notifyAuth();
    return currentUser;
  } catch (e) {
    console.warn('getCurrentUser error', e);
    return null;
  }
}

function authHeaders(): Record<string, string> {
  if (!authToken?.accessToken) return {};
  const type = authToken.tokenType || 'Bearer';
  return { Authorization: `${type} ${authToken.accessToken}` };
}

// Initiate GitHub OAuth: server likely redirects
export function loginWithGitHub() {
  // Optionally pass current location as redirect param if backend expects it
  const redirect = encodeURIComponent(window.location.href);
  window.location.href = `${API_BASE_URL}/auth/github?redirect=${redirect}`;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders()
    });
  } catch (e) {
    console.warn('Logout request failed', e);
  } finally {
    authToken = null;
    currentUser = null;
    persistToken();
    notifyAuth();
  }
}

// Parse possible auth callback parameters (adjust names after backend spec confirmed)
export function handleAuthCallback(): boolean {
  loadTokenFromStorage();
  const url = new URL(window.location.href);
  const params = url.searchParams;
  let updated = false;

  const potentialToken = params.get('token') || params.get('access_token');
  if (potentialToken) {
    authToken = {
      accessToken: potentialToken,
      tokenType: params.get('token_type') || 'Bearer',
      expiresAt: params.get('expires_at') || undefined,
      refreshToken: params.get('refresh_token') || undefined
    };
    persistToken();
    updated = true;
    // Clean URL (remove token params)
    params.delete('token');
    params.delete('access_token');
    params.delete('token_type');
    params.delete('expires_at');
    params.delete('refresh_token');
    const newUrl = url.origin + url.pathname + (params.toString() ? '?' + params.toString() : '') + url.hash;
    window.history.replaceState({}, '', newUrl);
    // Optionally fetch current user
    getCurrentUser().catch(() => {});
  }

  if (updated) notifyAuth();
  return updated;
}

// Generic GET wrapper
export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: authHeaders()
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

// Generic POST wrapper
export async function apiPost<T = unknown>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

// Future: refreshToken(), revokeToken(), etc.
