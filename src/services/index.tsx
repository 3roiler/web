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

export interface SocialLink {
  id: string;
  userId: string;
  label: string;
  url: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface SocialLinkInput {
  label: string;
  url: string;
}

export interface User {
  id: string;
  name: string;
  display_name: string;
  displayName?: string | null;
  email: string;
  avatarUrl?: string | null;
  permissions?: string[];
  socialLinks?: SocialLink[];
}

export interface UpdateMeInput {
  displayName?: string | null;
  avatarUrl?: string | null;
  socialLinks?: SocialLinkInput[];
}

export interface AdminUser {
  id: string;
  name: string;
  displayName: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string | null;
  /** Direct + group-inherited permissions, distinct and sorted. */
  permissions: string[];
  /** Only the direct-grant subset (what the revoke endpoint can delete). */
  directPermissions: string[];
}

export interface PermissionDefinition {
  key: string;
  description: string;
}

export interface UserUpdateInput {
  name?: string;
  displayName?: string | null;
  email?: string | null;
}

export interface AdminGroup {
  id: string;
  basedOn: string | null;
  key: string;
  displayName: string;
  createdAt: string;
  updatedAt: string | null;
  memberCount: number;
  permissions: string[];
}

export interface AdminGroupMember {
  id: string;
  name: string;
  displayName: string | null;
  email: string | null;
}

export interface AdminGroupDetail extends AdminGroup {
  members: AdminGroupMember[];
}

export interface GroupCreateInput {
  key: string;
  displayName: string;
}

export interface GroupUpdateInput {
  key?: string;
  displayName?: string;
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

export async function updateMe(input: UpdateMeInput): Promise<User> {
  try {
    const response = await axios.put<User>(`${getApiBaseUrl()}/user/me`, input, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Profil konnte nicht gespeichert werden.');
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

// Admin / Permissions

export async function listAdminUsers(): Promise<AdminUser[]> {
  try {
    const response = await axios.get<AdminUser[]>(`${getApiBaseUrl()}/admin/users`, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Beim Laden der Benutzerliste ist ein Fehler aufgetreten.');
  }
}

export async function listGrantablePermissions(): Promise<PermissionDefinition[]> {
  try {
    const response = await axios.get<PermissionDefinition[]>(`${getApiBaseUrl()}/admin/permissions`, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Beim Laden der Berechtigungsliste ist ein Fehler aufgetreten.');
  }
}

export async function grantPermission(userId: string, permission: string): Promise<void> {
  try {
    await axios.post(
      `${getApiBaseUrl()}/admin/users/${encodeURIComponent(userId)}/permissions`,
      { permission },
      AXIOS_OPTIONS
    );
  } catch (error: unknown) {
    toApiError(error, 'Berechtigung konnte nicht erteilt werden.');
  }
}

export async function revokePermission(userId: string, permission: string): Promise<void> {
  try {
    await axios.delete(
      `${getApiBaseUrl()}/admin/users/${encodeURIComponent(userId)}/permissions/${encodeURIComponent(permission)}`,
      AXIOS_OPTIONS
    );
  } catch (error: unknown) {
    toApiError(error, 'Berechtigung konnte nicht entzogen werden.');
  }
}

export async function updateAdminUser(id: string, input: UserUpdateInput): Promise<AdminUser> {
  try {
    const response = await axios.put<AdminUser>(
      `${getApiBaseUrl()}/admin/users/${encodeURIComponent(id)}`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Beim Aktualisieren des Nutzers ist ein Fehler aufgetreten.');
  }
}

export async function deleteAdminUser(id: string): Promise<void> {
  try {
    await axios.delete(`${getApiBaseUrl()}/admin/users/${encodeURIComponent(id)}`, AXIOS_OPTIONS);
  } catch (error: unknown) {
    toApiError(error, 'Beim Löschen des Nutzers ist ein Fehler aufgetreten.');
  }
}

// Admin / Groups

export async function listAdminGroups(): Promise<AdminGroup[]> {
  try {
    const response = await axios.get<AdminGroup[]>(`${getApiBaseUrl()}/admin/groups`, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Beim Laden der Gruppen ist ein Fehler aufgetreten.');
  }
}

export async function getAdminGroup(id: string): Promise<AdminGroupDetail> {
  try {
    const response = await axios.get<AdminGroupDetail>(
      `${getApiBaseUrl()}/admin/groups/${encodeURIComponent(id)}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Beim Laden der Gruppe ist ein Fehler aufgetreten.');
  }
}

export async function createAdminGroup(input: GroupCreateInput): Promise<AdminGroup> {
  try {
    const response = await axios.post<AdminGroup>(
      `${getApiBaseUrl()}/admin/groups`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Beim Anlegen der Gruppe ist ein Fehler aufgetreten.');
  }
}

export async function updateAdminGroup(id: string, input: GroupUpdateInput): Promise<AdminGroup> {
  try {
    const response = await axios.put<AdminGroup>(
      `${getApiBaseUrl()}/admin/groups/${encodeURIComponent(id)}`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Beim Aktualisieren der Gruppe ist ein Fehler aufgetreten.');
  }
}

export async function deleteAdminGroup(id: string): Promise<void> {
  try {
    await axios.delete(`${getApiBaseUrl()}/admin/groups/${encodeURIComponent(id)}`, AXIOS_OPTIONS);
  } catch (error: unknown) {
    toApiError(error, 'Beim Löschen der Gruppe ist ein Fehler aufgetreten.');
  }
}

export async function addGroupMember(groupId: string, userId: string): Promise<void> {
  try {
    await axios.post(
      `${getApiBaseUrl()}/admin/groups/${encodeURIComponent(groupId)}/members`,
      { userId },
      AXIOS_OPTIONS
    );
  } catch (error: unknown) {
    toApiError(error, 'Mitglied konnte nicht hinzugefügt werden.');
  }
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  try {
    await axios.delete(
      `${getApiBaseUrl()}/admin/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
      AXIOS_OPTIONS
    );
  } catch (error: unknown) {
    toApiError(error, 'Mitglied konnte nicht entfernt werden.');
  }
}

export async function grantGroupPermission(groupId: string, permission: string): Promise<void> {
  try {
    await axios.post(
      `${getApiBaseUrl()}/admin/groups/${encodeURIComponent(groupId)}/permissions`,
      { permission },
      AXIOS_OPTIONS
    );
  } catch (error: unknown) {
    toApiError(error, 'Berechtigung konnte nicht erteilt werden.');
  }
}

export async function revokeGroupPermission(groupId: string, permission: string): Promise<void> {
  try {
    await axios.delete(
      `${getApiBaseUrl()}/admin/groups/${encodeURIComponent(groupId)}/permissions/${encodeURIComponent(permission)}`,
      AXIOS_OPTIONS
    );
  } catch (error: unknown) {
    toApiError(error, 'Berechtigung konnte nicht entzogen werden.');
  }
}
