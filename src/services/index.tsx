import axios, { AxiosError } from 'axios';
import { getApiBaseUrl } from '../config/api';
import { Routes } from '../config/routes';

const ClientId = 'Ov23liULYLUWCVnTGLLN';
const Scope = 'read:user user:email';

export class ApiError extends Error {
  readonly status: number;
  readonly identifier: string;

  constructor(status: number, identifier: string, message: string) {
    super(`API Error (${status}, ${identifier}): ${message}`);
    this.name = 'ApiError';
    this.status = status;
    this.identifier = identifier;
  }
}

export interface User {
  id: string;
  name: string;
  display_name: string;
  email: string;
  permissions?: string[];
}

export interface BlogPost {
  id: string;
  authorId: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface BlogPostInput {
  slug: string;
  title: string;
  content: string;
  excerpt?: string | null;
  publish?: boolean;
}

interface ApiErrorPayload {
  identifier?: string;
  message?: string;
}

function toApiError(error: unknown, fallback: string): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorPayload>;
    const response = axiosError.response;
    if (response) {
      const payload = response.data ?? {};
      throw new ApiError(response.status, payload.identifier ?? 'unknown', payload.message ?? axiosError.message);
    }
  }
  throw new Error(fallback);
}

const AXIOS_OPTIONS = {
  withCredentials: true
} as const;

export async function getMe(): Promise<User> {
  try {
    const response = await axios.get<User>(`${getApiBaseUrl()}/user/me`, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'An unknown error occurred while fetching user data.');
  }
}

export async function nuke(): Promise<void> {
  try {
    await axios.post(`${getApiBaseUrl()}/user/nuke`, {}, AXIOS_OPTIONS);
  } catch (error: unknown) {
    toApiError(error, 'An unknown error occurred while attempting to delete the user account.');
  }
}

/**
 * Generates a cryptographically-random state string for OAuth flows.
 * Replaces Math.random (SonarCloud javascript:S2245).
 */
function secureRandomState(byteLength = 16): string {
  const buf = new Uint8Array(byteLength);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
}

export function loginToGithub(): void {
  const { host, protocol } = globalThis.location;

  const params = new URLSearchParams({
    redirect_uri: `${protocol}//${host}${Routes.Callback.Github}`,
    client_id: ClientId,
    scope: Scope,
    state: secureRandomState()
  });

  globalThis.location.href = `${Routes.External.GithubOauth}?${params.toString()}`;
}

export async function authenticateGithub(code: string, state: string): Promise<User> {
  try {
    const response = await axios.post<User>(`${getApiBaseUrl()}/github/oauth`, {
      code,
      state
    }, AXIOS_OPTIONS);

    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'An unknown error occurred during GitHub authentication.');
  }
}

export async function logout(): Promise<void> {
  try {
    await axios.post(`${getApiBaseUrl()}/logout`, {}, AXIOS_OPTIONS);
  } catch (error: unknown) {
    toApiError(error, 'An unknown error occurred during logout.');
  }
}

// Blog

export async function listBlogPosts(includeDrafts = false): Promise<BlogPost[]> {
  try {
    const url = includeDrafts
      ? `${getApiBaseUrl()}/blog?drafts=true`
      : `${getApiBaseUrl()}/blog`;
    const response = await axios.get<BlogPost[]>(url, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Beim Laden der Blog-Liste ist ein Fehler aufgetreten.');
  }
}

export async function getBlogPost(slug: string): Promise<BlogPost> {
  try {
    const response = await axios.get<BlogPost>(`${getApiBaseUrl()}/blog/${encodeURIComponent(slug)}`, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Beim Laden des Blog-Posts ist ein Fehler aufgetreten.');
  }
}

export async function createBlogPost(input: BlogPostInput): Promise<BlogPost> {
  try {
    const response = await axios.post<BlogPost>(`${getApiBaseUrl()}/blog`, input, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Beim Erstellen des Blog-Posts ist ein Fehler aufgetreten.');
  }
}

export async function updateBlogPost(id: string, input: Partial<BlogPostInput>): Promise<BlogPost> {
  try {
    const response = await axios.put<BlogPost>(`${getApiBaseUrl()}/blog/${encodeURIComponent(id)}`, input, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Beim Aktualisieren des Blog-Posts ist ein Fehler aufgetreten.');
  }
}

export async function deleteBlogPost(id: string): Promise<void> {
  try {
    await axios.delete(`${getApiBaseUrl()}/blog/${encodeURIComponent(id)}`, AXIOS_OPTIONS);
  } catch (error: unknown) {
    toApiError(error, 'Beim Löschen des Blog-Posts ist ein Fehler aufgetreten.');
  }
}
