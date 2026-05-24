import axios, { AxiosError, AxiosHeaders } from 'axios';
import { getApiBaseUrl, getApiEnvironment } from '../config/api';
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
  /** Wenn gesetzt: Account ist anonymisiert. UI rendert „Gelöschter
   *  Nutzer", Login ist bereits abgelaufen. */
  deletedAt?: string | null;
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
  /** Set when the account has been self-anonymized. UI shows a marker. */
  deletedAt?: string | null;
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

/**
 * Same set the API's blog service validates against. Keep in sync with
 * `VALID_VISIBILITIES` in `api/src/services/blog.ts`.
 */
export type BlogPostVisibility = "public" | "authenticated" | "group";

export interface BlogPost {
  id: string;
  authorId: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  publishedAt: string | null;
  visibility: BlogPostVisibility;
  /** Group UUIDs a `group`-visibility post is linked to. Empty otherwise. */
  accessGroupIds: string[];
  createdAt: string;
  updatedAt: string | null;
}

export interface BlogPostInput {
  slug: string;
  title: string;
  content: string;
  excerpt?: string | null;
  publish?: boolean;
  /** Omit to keep `public` on create / leave unchanged on update. */
  visibility?: BlogPostVisibility;
  /** Required (non-empty) when `visibility === "group"`. */
  groupIds?: string[];
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

/**
 * CSRF (Double-Submit-Cookie): Das Backend setzt ein `XSRF-TOKEN`-Cookie und
 * liefert den Wert über `GET /csrf`. Da Frontend (broiler.dev) und API
 * (api.broiler.dev) auf verschiedenen Subdomains liegen, kann das SPA das
 * Cookie nicht direkt lesen — wir holen den Token daher aus dem Body, cachen
 * ihn und schicken ihn bei mutierenden Requests im `X-CSRF-Token`-Header.
 * Bei einem 403 `CSRF_TOKEN` (z. B. direkt nach einem Deploy, bevor das
 * Cookie gesetzt war) holen wir den Token neu und wiederholen den Request
 * genau einmal.
 */
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);
let csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string | null> {
  try {
    const res = await axios.get<{ csrfToken: string }>(`${getApiBaseUrl()}/csrf`, AXIOS_OPTIONS);
    csrfToken = res.data?.csrfToken ?? null;
  } catch {
    csrfToken = null;
  }
  return csrfToken;
}

function setCsrfHeader(headers: AxiosHeaders | undefined, token: string): AxiosHeaders {
  const h = headers ?? new AxiosHeaders();
  h.set('X-CSRF-Token', token);
  return h;
}

axios.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toLowerCase();
  const url = typeof config.url === 'string' ? config.url : '';
  if (MUTATING_METHODS.has(method) && url.startsWith(getApiBaseUrl())) {
    const token = csrfToken ?? (await fetchCsrfToken());
    if (token) config.headers = setCsrfHeader(config.headers, token);
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 403 && error.config) {
      const payload = error.response.data as ApiErrorPayload | undefined;
      const original = error.config as typeof error.config & { _csrfRetried?: boolean };
      if (payload?.identifier === 'CSRF_TOKEN' && !original._csrfRetried) {
        original._csrfRetried = true;
        const token = await fetchCsrfToken();
        if (token) original.headers = setCsrfHeader(original.headers as AxiosHeaders, token);
        return axios(original);
      }
    }
    return Promise.reject(error);
  }
);

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

/**
 * Slim profile returned by the search endpoint. Used in sharing flows
 * like the printer-access grant dialog — shows enough context that you
 * can pick the right person without leaking full user records.
 */
export interface UserSummary {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
}

export async function searchUsers(query: string, limit = 10): Promise<UserSummary[]> {
  try {
    const response = await axios.get<UserSummary[]>(
      `${getApiBaseUrl()}/user/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Suche fehlgeschlagen.');
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
 * Holt einen OAuth-`state` vom Backend.
 *
 * Hintergrund: Bisher wurde der State client-seitig mit
 * `crypto.getRandomValues` gewürfelt und in der OAuth-URL mitgegeben.
 * Das schützt gegen Brute-Force-Raten, NICHT aber gegen Login-CSRF:
 * ohne server-seitige Bindung kann ein Angreifer den Flow des Opfers
 * mit eigenem `state` entführen.
 *
 * Neu: Das Backend würfelt den State, legt ihn als kurzlebiges
 * HttpOnly-Cookie ab und gibt ihn zusätzlich im Body zurück. Beim
 * Callback geht derselbe State im Body wieder hoch und das Backend
 * validiert ihn gegen das Cookie. `withCredentials: true` ist Pflicht
 * — sonst landet das Cookie nicht im Browser-Jar (Cross-Subdomain
 * `api.broiler.dev` → `broiler.dev`).
 */
async function fetchOauthState(provider: 'github' | 'twitch'): Promise<string> {
  try {
    const response = await axios.get<{ state: string }>(
      `${getApiBaseUrl()}/${provider}/oauth-state`,
      AXIOS_OPTIONS
    );
    return response.data.state;
  } catch (error: unknown) {
    toApiError(error, 'OAuth-State konnte nicht angefordert werden.');
  }
}

export async function loginToGithub(): Promise<void> {
  const { host, protocol } = globalThis.location;
  const state = await fetchOauthState('github');

  const params = new URLSearchParams({
    redirect_uri: `${protocol}//${host}${Routes.Callback.Github}`,
    client_id: ClientId,
    scope: Scope,
    state
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

/** Hängt optionale limit/offset an eine Query an → „?…"-Suffix (oder ""). */
function withPagingQuery(params: URLSearchParams, limit?: number, offset?: number): string {
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// Blog

export async function listBlogPosts(
  includeDrafts = false,
  limit?: number,
  offset?: number
): Promise<BlogPost[]> {
  try {
    const params = new URLSearchParams();
    if (includeDrafts) params.set('drafts', 'true');
    const response = await axios.get<BlogPost[]>(
      `${getApiBaseUrl()}/blog${withPagingQuery(params, limit, offset)}`,
      AXIOS_OPTIONS
    );
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

export interface AdminUserPage {
  users: AdminUser[];
  total: number;
}

export async function listAdminUsers(
  opts: { q?: string; limit?: number; offset?: number } = {}
): Promise<AdminUserPage> {
  try {
    const params = new URLSearchParams();
    if (opts.q) params.set('q', opts.q);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    const qs = params.toString();
    const response = await axios.get<AdminUserPage>(
      `${getApiBaseUrl()}/admin/users${qs ? `?${qs}` : ''}`,
      AXIOS_OPTIONS
    );
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

// ─── Dashboard · Settings & Secrets ────────────────────────────────────────

export interface AppSetting<T = unknown> {
  key: string;
  value: T;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

export interface AppSecretMeta {
  key: string;
  preview: string | null;
  description: string | null;
  hasValue: true;
  updatedBy: string | null;
  updatedAt: string;
}

export async function listAppSettings(): Promise<AppSetting[]> {
  try {
    const response = await axios.get<AppSetting[]>(`${getApiBaseUrl()}/admin/settings`, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Einstellungen konnten nicht geladen werden.');
  }
}

export async function getAppSetting<T = unknown>(key: string): Promise<AppSetting<T> | null> {
  try {
    const response = await axios.get<AppSetting<T>>(
      `${getApiBaseUrl()}/admin/settings/${encodeURIComponent(key)}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    toApiError(error, 'Einstellung konnte nicht geladen werden.');
  }
}

export async function upsertAppSetting<T = unknown>(
  key: string,
  value: T,
  description?: string | null
): Promise<AppSetting<T>> {
  try {
    const response = await axios.put<AppSetting<T>>(
      `${getApiBaseUrl()}/admin/settings/${encodeURIComponent(key)}`,
      { value, description: description ?? null },
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Einstellung konnte nicht gespeichert werden.');
  }
}

export async function deleteAppSetting(key: string): Promise<void> {
  try {
    await axios.delete(`${getApiBaseUrl()}/admin/settings/${encodeURIComponent(key)}`, AXIOS_OPTIONS);
  } catch (error: unknown) {
    toApiError(error, 'Einstellung konnte nicht gelöscht werden.');
  }
}

export async function listAppSecrets(): Promise<AppSecretMeta[]> {
  try {
    const response = await axios.get<AppSecretMeta[]>(
      `${getApiBaseUrl()}/admin/settings/secrets`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Secrets konnten nicht geladen werden.');
  }
}

export async function writeAppSecret(
  key: string,
  plaintext: string,
  description?: string | null
): Promise<AppSecretMeta> {
  try {
    const response = await axios.put<AppSecretMeta>(
      `${getApiBaseUrl()}/admin/settings/secrets/${encodeURIComponent(key)}`,
      { plaintext, description: description ?? null },
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Secret konnte nicht gespeichert werden.');
  }
}

export async function deleteAppSecret(key: string): Promise<void> {
  try {
    await axios.delete(
      `${getApiBaseUrl()}/admin/settings/secrets/${encodeURIComponent(key)}`,
      AXIOS_OPTIONS
    );
  } catch (error: unknown) {
    toApiError(error, 'Secret konnte nicht gelöscht werden.');
  }
}

// ─── Dashboard · Metrics (DigitalOcean proxy) ──────────────────────────────

/**
 * Metric time window accepted by the backend proxy. Mirrors
 * `VALID_WINDOWS` in `api/src/services/metrics.ts`.
 */
export type MetricsWindow = '1h' | '6h' | '24h';

export interface MetricsStatus {
  tokenConfigured: boolean;
  /** Count of configured apps (>= 1 means the user is good to render charts). */
  appsConfigured: number;
  databaseIdConfigured: boolean;
  refreshDefaultSeconds: number;
}

/**
 * One DigitalOcean app as returned by `/admin/metrics/apps`. `label` is a
 * human-friendly tag the operator chose in the Settings page — always
 * present (backend fills a UUID-prefix default when missing).
 */
export interface MetricsApp {
  id: string;
  label: string;
}

/**
 * Prometheus-style time-series response DO returns for every monitoring
 * metric. We keep the shape loose because different metrics label series
 * with different keys — the chart only cares about `values`.
 */
export interface DoTimeSeriesResult {
  metric: Record<string, string>;
  values: [number, string][];
}

export interface DoTimeSeriesResponse {
  status: string;
  data: {
    resultType: string;
    result: DoTimeSeriesResult[];
  };
}

export async function getMetricsStatus(): Promise<MetricsStatus> {
  try {
    const response = await axios.get<MetricsStatus>(
      `${getApiBaseUrl()}/admin/metrics/status`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Metriken-Status konnte nicht geladen werden.');
  }
}

export async function listMetricsApps(): Promise<MetricsApp[]> {
  try {
    const response = await axios.get<MetricsApp[]>(
      `${getApiBaseUrl()}/admin/metrics/apps`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'App-Liste konnte nicht geladen werden.');
  }
}

export async function getAppSummary<T = unknown>(appId: string): Promise<T> {
  try {
    const response = await axios.get<T>(
      `${getApiBaseUrl()}/admin/metrics/app/${encodeURIComponent(appId)}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'App-Status konnte nicht geladen werden.');
  }
}

export async function getDatabaseSummary<T = unknown>(): Promise<T> {
  try {
    const response = await axios.get<T>(`${getApiBaseUrl()}/admin/metrics/database`, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Datenbank-Status konnte nicht geladen werden.');
  }
}

async function fetchTimeSeries(path: string, window: MetricsWindow): Promise<DoTimeSeriesResponse> {
  try {
    const response = await axios.get<DoTimeSeriesResponse>(
      `${getApiBaseUrl()}${path}?window=${encodeURIComponent(window)}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Metrik konnte nicht geladen werden.');
  }
}

export const getAppCpu = (appId: string, window: MetricsWindow) =>
  fetchTimeSeries(`/admin/metrics/app/${encodeURIComponent(appId)}/cpu`, window);
export const getAppMemory = (appId: string, window: MetricsWindow) =>
  fetchTimeSeries(`/admin/metrics/app/${encodeURIComponent(appId)}/memory`, window);
export const getDatabaseCpu = (window: MetricsWindow) =>
  fetchTimeSeries('/admin/metrics/database/cpu', window);
export const getDatabaseMemory = (window: MetricsWindow) =>
  fetchTimeSeries('/admin/metrics/database/memory', window);
export const getDatabaseDisk = (window: MetricsWindow) =>
  fetchTimeSeries('/admin/metrics/database/disk', window);

// ─── Drucker & G-Code ─────────────────────────────────────────────────────

export type PrinterStatus = 'offline' | 'online' | 'error';
export type PrinterRole = 'owner' | 'operator' | 'contributor' | 'viewer';

export interface Printer {
  id: string;
  name: string;
  model: string;
  status: PrinterStatus;
  agentVersion: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface PrinterWithRole extends Printer {
  role: PrinterRole;
  canViewCamera: boolean;
  canViewQueue: boolean;
}

export interface PrinterAccess {
  id: string;
  printerId: string;
  userId: string;
  role: PrinterRole;
  canViewCamera: boolean;
  canViewQueue: boolean;
  grantedBy: string | null;
  grantedAt: string;
}

/** `PrinterAccess` enriched with the target user's public info. */
export interface PrinterAccessWithUser extends PrinterAccess {
  userName: string;
  userDisplayName: string | null;
  userAvatarUrl: string | null;
}

export interface CreatePrinterInput {
  name: string;
  model: string;
}

/**
 * Returned by `POST /printer/`. The `agentToken` is only visible on
 * create and on rotate — the backend keeps a SHA-256 hash, so the UI
 * must warn the user to copy it immediately.
 */
export interface CreatePrinterResult {
  printer: PrinterWithRole;
  agentToken: string;
}

export interface GcodeMetadata {
  estimatedSeconds?: number;
  filamentMeters?: number;
  filamentGrams?: number;
  layerCount?: number;
  slicer?: string;
}

export interface GcodeFile {
  id: string;
  uploadedByUserId: string | null;
  originalFilename: string;
  sha256: string;
  sizeBytes: number;
  metadata: GcodeMetadata;
  createdAt: string;
}

export async function listPrinters(): Promise<PrinterWithRole[]> {
  try {
    const response = await axios.get<PrinterWithRole[]>(`${getApiBaseUrl()}/printer`, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Drucker konnten nicht geladen werden.');
  }
}

export async function getPrinter(id: string): Promise<PrinterWithRole> {
  try {
    const response = await axios.get<PrinterWithRole>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(id)}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Drucker konnte nicht geladen werden.');
  }
}

export async function createPrinter(input: CreatePrinterInput): Promise<CreatePrinterResult> {
  try {
    const response = await axios.post<CreatePrinterResult>(
      `${getApiBaseUrl()}/printer`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Drucker konnte nicht angelegt werden.');
  }
}

export async function updatePrinter(id: string, input: { name?: string }): Promise<Printer> {
  try {
    const response = await axios.put<Printer>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(id)}`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Drucker konnte nicht aktualisiert werden.');
  }
}

export async function deletePrinter(id: string): Promise<void> {
  try {
    await axios.delete(`${getApiBaseUrl()}/printer/${encodeURIComponent(id)}`, AXIOS_OPTIONS);
  } catch (error: unknown) {
    toApiError(error, 'Drucker konnte nicht gelöscht werden.');
  }
}

export async function rotatePrinterToken(id: string): Promise<string> {
  try {
    const response = await axios.post<{ agentToken: string }>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(id)}/rotate-token`,
      {},
      AXIOS_OPTIONS
    );
    return response.data.agentToken;
  } catch (error: unknown) {
    toApiError(error, 'Agent-Token konnte nicht rotiert werden.');
  }
}

export async function listPrinterAccess(id: string): Promise<PrinterAccessWithUser[]> {
  try {
    const response = await axios.get<PrinterAccessWithUser[]>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(id)}/access`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Zugriffsliste konnte nicht geladen werden.');
  }
}

export async function grantPrinterAccess(
  id: string,
  input: {
    userId: string;
    role: 'operator' | 'contributor' | 'viewer';
    canViewCamera?: boolean;
    canViewQueue?: boolean;
  }
): Promise<PrinterAccess> {
  try {
    const response = await axios.post<PrinterAccess>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(id)}/access`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Zugriff konnte nicht erteilt werden.');
  }
}

export async function revokePrinterAccess(id: string, userId: string): Promise<void> {
  try {
    await axios.delete(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(id)}/access/${encodeURIComponent(userId)}`,
      AXIOS_OPTIONS
    );
  } catch (error: unknown) {
    toApiError(error, 'Zugriff konnte nicht entzogen werden.');
  }
}

/**
 * Builds a list/upload/delete trio for an asset endpoint that follows
 * the broiler raw-octet-stream convention (G-code, STL, future slicer
 * outputs). The label is a German noun fragment used in error
 * messages — "G-Code" → "G-Code-Datei konnte nicht ...".
 *
 * Lives next to `toApiError` so the per-call try/catch noise stays
 * confined to one place. Pages get back regular Promise-returning
 * functions and don't see the factory at all.
 */
function buildAssetClient<TFile>(basePath: string, label: string) {
  const base = () => `${getApiBaseUrl()}/${basePath}`;
  return {
    async list(limit?: number, offset?: number): Promise<TFile[]> {
      try {
        const r = await axios.get<TFile[]>(
          `${base()}${withPagingQuery(new URLSearchParams(), limit, offset)}`,
          AXIOS_OPTIONS
        );
        return r.data;
      } catch (error: unknown) {
        toApiError(error, `${label}-Dateien konnten nicht geladen werden.`);
      }
    },
    /**
     * Raw body upload via `application/octet-stream` + `X-Filename`.
     * Matches the API's `express.raw` route — multipart was considered
     * and dropped, single raw blob has zero framing overhead and needs
     * no extra deps on either side.
     */
    async upload(file: File): Promise<TFile> {
      try {
        const r = await axios.post<TFile>(base(), file, {
          ...AXIOS_OPTIONS,
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Filename': file.name
          }
        });
        return r.data;
      } catch (error: unknown) {
        toApiError(error, `${label}-Datei konnte nicht hochgeladen werden.`);
      }
    },
    async delete(id: string): Promise<void> {
      try {
        await axios.delete(`${base()}/${encodeURIComponent(id)}`, AXIOS_OPTIONS);
      } catch (error: unknown) {
        toApiError(error, `${label}-Datei konnte nicht gelöscht werden.`);
      }
    }
  };
}

const gcodeAssets = buildAssetClient<GcodeFile>('gcode', 'G-Code');

export const listGcodeFiles = (limit?: number, offset?: number): Promise<GcodeFile[]> =>
  gcodeAssets.list(limit, offset);
export const uploadGcodeFile = (file: File): Promise<GcodeFile> => gcodeAssets.upload(file);
export const deleteGcodeFile = (id: string): Promise<void> => gcodeAssets.delete(id);

/**
 * Returns the raw G-code body as a string. Owner-scoped on the server
 * (only the uploader can fetch). Used by the editor — UTF-8 is fine
 * because slicers emit ASCII / Latin-1 text and the rare Windows-1252
 * escape sequences round-trip through JS strings without loss.
 */
export async function getGcodeContent(id: string): Promise<string> {
  try {
    const response = await axios.get<string>(
      `${getApiBaseUrl()}/gcode/${encodeURIComponent(id)}/content`,
      { ...AXIOS_OPTIONS, responseType: 'text', transformResponse: [(d: unknown) => String(d ?? '')] }
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'G-Code-Inhalt konnte nicht geladen werden.');
  }
}

// ─── STL ───────────────────────────────────────────────────────────────────

export interface StlMetadata {
  format?: 'ascii' | 'binary';
  triangleCount?: number;
}

export interface StlFile {
  id: string;
  uploadedByUserId: string | null;
  originalFilename: string;
  sha256: string;
  sizeBytes: number;
  metadata: StlMetadata;
  createdAt: string;
}

const stlAssets = buildAssetClient<StlFile>('stl', 'STL');

export const listStlFiles = (limit?: number, offset?: number): Promise<StlFile[]> =>
  stlAssets.list(limit, offset);
export const uploadStlFile = (file: File): Promise<StlFile> => stlAssets.upload(file);
export const deleteStlFile = (id: string): Promise<void> => stlAssets.delete(id);

// ─── Print-Request ─────────────────────────────────────────────────────────

export type PrintRequestStatus =
  | 'new'
  | 'accepted'
  | 'printing'
  | 'done'
  | 'rejected'
  | 'cancelled';

export type PrintRequestSourceType = 'stl_upload' | 'external_link';

export interface PrintRequest {
  id: string;
  requesterUserId: string;
  title: string;
  description: string | null;
  sourceType: PrintRequestSourceType;
  stlFileId: string | null;
  externalUrl: string | null;
  assignedPrinterId: string | null;
  status: PrintRequestStatus;
  createdAt: string;
  updatedAt: string | null;
}

/** List + detail rows from the API include requester / STL / printer
 *  display so the UI doesn't need follow-up lookups. */
export interface PrintRequestWithContext extends PrintRequest {
  requesterName: string;
  requesterDisplayName: string | null;
  requesterAvatarUrl: string | null;
  stlFilename: string | null;
  printerName: string | null;
}

export interface PrintRequestComment {
  id: string;
  requestId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
}

export interface PrintRequestCommentWithAuthor extends PrintRequestComment {
  authorName: string;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
}

export interface PrintRequestDetail extends PrintRequestWithContext {
  comments: PrintRequestCommentWithAuthor[];
}

export interface CreatePrintRequestInput {
  title: string;
  description?: string | null;
  sourceType: PrintRequestSourceType;
  stlFileId?: string;
  externalUrl?: string;
}

export async function listPrintRequests(opts?: {
  mine?: boolean;
  status?: PrintRequestStatus[];
  limit?: number;
  offset?: number;
}): Promise<PrintRequestWithContext[]> {
  try {
    const params = new URLSearchParams();
    if (opts?.mine) params.set('mine', '1');
    if (opts?.status?.length) params.set('status', opts.status.join(','));
    const response = await axios.get<PrintRequestWithContext[]>(
      `${getApiBaseUrl()}/print-request${withPagingQuery(params, opts?.limit, opts?.offset)}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Druckanfragen konnten nicht geladen werden.');
  }
}

export async function getPrintRequest(id: string): Promise<PrintRequestDetail> {
  try {
    const response = await axios.get<PrintRequestDetail>(
      `${getApiBaseUrl()}/print-request/${encodeURIComponent(id)}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Druckanfrage konnte nicht geladen werden.');
  }
}

export async function createPrintRequest(input: CreatePrintRequestInput): Promise<PrintRequest> {
  try {
    const response = await axios.post<PrintRequest>(
      `${getApiBaseUrl()}/print-request`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Druckanfrage konnte nicht angelegt werden.');
  }
}

export async function updatePrintRequest(
  id: string,
  input: { status?: PrintRequestStatus; assignedPrinterId?: string | null }
): Promise<PrintRequest> {
  try {
    const response = await axios.patch<PrintRequest>(
      `${getApiBaseUrl()}/print-request/${encodeURIComponent(id)}`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Druckanfrage konnte nicht aktualisiert werden.');
  }
}

export async function cancelPrintRequest(id: string): Promise<PrintRequest> {
  try {
    const response = await axios.post<PrintRequest>(
      `${getApiBaseUrl()}/print-request/${encodeURIComponent(id)}/cancel`,
      {},
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Druckanfrage konnte nicht zurückgezogen werden.');
  }
}

export async function addPrintRequestComment(
  id: string,
  body: string
): Promise<PrintRequestComment> {
  try {
    const response = await axios.post<PrintRequestComment>(
      `${getApiBaseUrl()}/print-request/${encodeURIComponent(id)}/comment`,
      { body },
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Kommentar konnte nicht gesendet werden.');
  }
}

/**
 * Returns the raw STL bytes as an `ArrayBuffer`, ready to feed three.js'
 * `STLLoader.parse`. We don't try to decode here — the loader handles
 * both ASCII and binary STL transparently.
 */
export async function getStlContent(id: string): Promise<ArrayBuffer> {
  try {
    const response = await axios.get<ArrayBuffer>(
      `${getApiBaseUrl()}/stl/${encodeURIComponent(id)}/content`,
      { ...AXIOS_OPTIONS, responseType: 'arraybuffer' }
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'STL-Inhalt konnte nicht geladen werden.');
  }
}

// ─── Druck-Jobs ────────────────────────────────────────────────────────────

export type PrintJobState =
  | 'requested'
  | 'queued'
  | 'transferring'
  | 'printing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface PrintJob {
  id: string;
  printerId: string;
  userId: string | null;
  gcodeFileId: string;
  state: PrintJobState;
  priority: number;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  moonrakerJobId: string | null;
  progress: number | null;
}

export interface PrintEvent {
  id: string;
  printJobId: string;
  eventType: string;
  payload: Record<string, unknown>;
  ts: string;
}

/** Detail view returned by `GET /printer/:id/jobs/:jobId`. */
export interface PrintJobDetail extends PrintJob {
  events: PrintEvent[];
}

/**
 * Input for the legacy "queue a job under a printer" flow (used by the
 * old PrinterJobs page). Renamed away from `CreatePrintRequestInput`
 * once the standalone print-request resource landed; the public flow
 * now owns that name.
 */
export interface CreatePrintJobRequestInput {
  gcodeFileId: string;
}

export async function listPrintJobs(
  printerId: string,
  opts?: { state?: PrintJobState[]; limit?: number; offset?: number }
): Promise<PrintJob[]> {
  try {
    const params = new URLSearchParams();
    if (opts?.state?.length) params.set('state', opts.state.join(','));
    if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
    const qs = params.toString();
    const response = await axios.get<PrintJob[]>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(printerId)}/jobs${qs ? `?${qs}` : ''}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Druckqueue konnte nicht geladen werden.');
  }
}

/**
 * Fetches the single job the printer is handling right now (transferring /
 * printing / paused) or null if idle. Anyone with access can see this.
 */
export async function getCurrentPrintJob(printerId: string): Promise<PrintJob | null> {
  try {
    const response = await axios.get(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(printerId)}/jobs/current`,
      { ...AXIOS_OPTIONS, validateStatus: (s) => s === 200 || s === 204 }
    );
    if (response.status === 204) return null;
    return response.data as PrintJob;
  } catch (error: unknown) {
    toApiError(error, 'Aktiver Druckjob konnte nicht geladen werden.');
  }
}

/**
 * Legacy "contributor enqueues a print under a specific printer" flow.
 * The job lands in `requested` state and a moderator approves before
 * the queue picks it up.
 *
 * Distinct from `createPrintRequest` (the standalone print-request
 * resource on the public page) — this path is printer-bound and used
 * from the dashboard's PrinterJobs view.
 */
export async function createPrintJobRequest(
  printerId: string,
  input: CreatePrintJobRequestInput
): Promise<PrintJob> {
  try {
    const response = await axios.post<PrintJob>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(printerId)}/jobs`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Druckjob konnte nicht angelegt werden.');
  }
}

export async function approvePrintJob(
  printerId: string,
  jobId: string,
  priority = 0
): Promise<PrintJob> {
  try {
    const response = await axios.post<PrintJob>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(printerId)}/jobs/${encodeURIComponent(jobId)}/approve`,
      { priority },
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Druckanfrage konnte nicht genehmigt werden.');
  }
}

export async function rejectPrintJob(
  printerId: string,
  jobId: string,
  reason: string
): Promise<PrintJob> {
  try {
    const response = await axios.post<PrintJob>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(printerId)}/jobs/${encodeURIComponent(jobId)}/reject`,
      { reason },
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Druckanfrage konnte nicht abgelehnt werden.');
  }
}

/**
 * Explicitly hands a queued job to the printer. The agent sees it on
 * its next poll via `/api/agent/jobs/current`.
 */
export async function startPrintJob(printerId: string, jobId: string): Promise<PrintJob> {
  try {
    const response = await axios.post<PrintJob>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(printerId)}/jobs/${encodeURIComponent(jobId)}/start`,
      {},
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Druck konnte nicht gestartet werden.');
  }
}

/**
 * Replaces the G-code attached to a still-pending job (requested or
 * queued). Used by the editor flow.
 */
export async function replaceJobGcode(
  printerId: string,
  jobId: string,
  newGcodeFileId: string
): Promise<PrintJob> {
  try {
    const response = await axios.put<PrintJob>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(printerId)}/jobs/${encodeURIComponent(jobId)}/gcode`,
      { gcodeFileId: newGcodeFileId },
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'G-Code konnte nicht getauscht werden.');
  }
}

export async function getPrintJob(printerId: string, jobId: string): Promise<PrintJobDetail> {
  try {
    const response = await axios.get<PrintJobDetail>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(printerId)}/jobs/${encodeURIComponent(jobId)}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Druckjob konnte nicht geladen werden.');
  }
}

export async function updatePrintJobPriority(
  printerId: string,
  jobId: string,
  priority: number
): Promise<PrintJob> {
  try {
    const response = await axios.patch<PrintJob>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(printerId)}/jobs/${encodeURIComponent(jobId)}/priority`,
      { priority },
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Priorität konnte nicht geändert werden.');
  }
}

export async function cancelPrintJob(printerId: string, jobId: string): Promise<PrintJob> {
  try {
    const response = await axios.post<PrintJob>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(printerId)}/jobs/${encodeURIComponent(jobId)}/cancel`,
      {},
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Druckjob konnte nicht abgebrochen werden.');
  }
}

// ─── Streamclips Germany ─────────────────────────────────────────────────────

/**
 * Twitch OAuth Client-IDs je API-Umgebung. Öffentlich (erscheinen im
 * OAuth-Redirect), daher hartkodiert wie die GitHub-`ClientId`. Jede ID
 * MUSS zur Twitch-App gehören, deren Redirect-URLs die jeweilige Domain
 * enthalten (sonst „invalid client" / redirect-Mismatch), und mit
 * `TWITCH_CLIENT_ID` im API-.env der jeweiligen Umgebung übereinstimmen.
 */
const TWITCH_CLIENT_IDS: Record<string, string> = {
  Development: 'eygoi5z4tf067fztfm6wr167iebviy',
  Staging: '2obalcga4dfzx9e5o6roosoedvhxtt',
  Production: '2obalcga4dfzx9e5o6roosoedvhxtt'
};
// Reicht für Login + E-Mail-Verknüpfung. Clip-Metadaten holt das Backend
// mit seinem eigenen App-Token, dafür ist kein User-Scope nötig.
const TwitchScope = 'user:read:email';

function getTwitchClientId(): string {
  return TWITCH_CLIENT_IDS[getApiEnvironment()] ?? TWITCH_CLIENT_IDS.Development;
}

export async function loginToTwitch(): Promise<void> {
  const { host, protocol } = globalThis.location;
  const state = await fetchOauthState('twitch');
  const params = new URLSearchParams({
    client_id: getTwitchClientId(),
    redirect_uri: `${protocol}//${host}${Routes.Callback.Twitch}`,
    response_type: 'code',
    scope: TwitchScope,
    state
  });
  globalThis.location.href = `${Routes.External.TwitchOauth}?${params.toString()}`;
}

export interface TwitchLoginResult {
  user: User;
  twitch: { login: string; displayName: string };
}

export async function authenticateTwitch(code: string, state: string): Promise<TwitchLoginResult> {
  try {
    const redirectUri = `${globalThis.location.protocol}//${globalThis.location.host}${Routes.Callback.Twitch}`;
    const response = await axios.post<TwitchLoginResult>(
      `${getApiBaseUrl()}/twitch/oauth`,
      { code, state, redirect_uri: redirectUri },
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Twitch-Anmeldung fehlgeschlagen.');
  }
}

export type ClipStatus = 'pending' | 'approved' | 'rejected' | 'flagged';
export type ClipSection =
  | 'gaming' | 'just_chatting' | 'irl' | 'music' | 'esports' | 'creative' | 'other';

export interface AwardCategory {
  id: string;
  key: string;
  displayName: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface SectionOption {
  key: ClipSection;
  label: string;
}

export interface ClipAwardTally {
  key: string;
  displayName: string;
  emoji: string | null;
  color: string | null;
  count: number;
}

export interface Clip {
  id: string;
  twitchClipId: string;
  submittedByUserId: string;
  title: string;
  broadcasterId: string | null;
  broadcasterName: string | null;
  creatorName: string | null;
  gameId: string | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  viewCount: number;
  language: string | null;
  clipCreatedAt: string | null;
  status: ClipStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ClipWithContext extends Clip {
  submitterName: string;
  submitterDisplayName: string | null;
  submitterAvatarUrl: string | null;
  categoryName: string | null;
  section: ClipSection | null;
  ratingCount: number;
  avgScore: number | null;
  awards: ClipAwardTally[];
}

export interface ClipRating {
  id: string;
  clipId: string;
  userId: string;
  score: number | null;
  isSkipped: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface ClipDetail extends ClipWithContext {
  myRating: (ClipRating & { awardIds: string[] }) | null;
}

export interface RateClipInput {
  score?: number | null;
  awardIds?: string[];
  skipped?: boolean;
}

export interface ClipReportWithContext {
  id: string;
  clipId: string;
  reporterUserId: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  reporterName: string;
  clipTitle: string;
  clipStatus: ClipStatus;
  clipThumbnailUrl: string | null;
}

// ── Öffentlich / eingeloggt ──

export async function submitClip(url: string): Promise<Clip> {
  try {
    const response = await axios.post<Clip>(`${getApiBaseUrl()}/clips`, { url }, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Clip konnte nicht eingereicht werden.');
  }
}

export async function getNextClip(section?: ClipSection): Promise<ClipWithContext | null> {
  try {
    const qs = section ? `?section=${encodeURIComponent(section)}` : '';
    const response = await axios.get<{ clip: ClipWithContext | null }>(
      `${getApiBaseUrl()}/clips/feed/next${qs}`,
      AXIOS_OPTIONS
    );
    return response.data.clip;
  } catch (error: unknown) {
    toApiError(error, 'Nächster Clip konnte nicht geladen werden.');
  }
}

export async function rateClip(clipId: string, input: RateClipInput): Promise<ClipRating> {
  try {
    const response = await axios.post<ClipRating>(
      `${getApiBaseUrl()}/clips/${encodeURIComponent(clipId)}/rating`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Bewertung konnte nicht gespeichert werden.');
  }
}

export async function getMyClips(): Promise<ClipWithContext[]> {
  try {
    const response = await axios.get<ClipWithContext[]>(`${getApiBaseUrl()}/clips/mine`, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Eigene Clips konnten nicht geladen werden.');
  }
}

export async function getClip(id: string): Promise<ClipDetail> {
  try {
    const response = await axios.get<ClipDetail>(
      `${getApiBaseUrl()}/clips/${encodeURIComponent(id)}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Clip konnte nicht geladen werden.');
  }
}

export async function reportClip(id: string, reason: string): Promise<void> {
  try {
    await axios.post(`${getApiBaseUrl()}/clips/${encodeURIComponent(id)}/report`, { reason }, AXIOS_OPTIONS);
  } catch (error: unknown) {
    toApiError(error, 'Meldung konnte nicht gesendet werden.');
  }
}

export type LeaderboardPeriod = 'all' | 'month' | 'week';

export async function getLeaderboard(
  section?: ClipSection,
  limit = 20,
  period: LeaderboardPeriod = 'all'
): Promise<ClipWithContext[]> {
  try {
    const params = new URLSearchParams();
    if (section) params.set('section', section);
    if (period !== 'all') params.set('period', period);
    params.set('limit', String(limit));
    const response = await axios.get<ClipWithContext[]>(
      `${getApiBaseUrl()}/clips/leaderboard?${params.toString()}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Leaderboard konnte nicht geladen werden.');
  }
}

export async function getAwards(): Promise<AwardCategory[]> {
  try {
    const response = await axios.get<AwardCategory[]>(`${getApiBaseUrl()}/categories/awards`, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Award-Kategorien konnten nicht geladen werden.');
  }
}

export async function getSections(): Promise<SectionOption[]> {
  try {
    const response = await axios.get<SectionOption[]>(`${getApiBaseUrl()}/categories/sections`, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Sektionen konnten nicht geladen werden.');
  }
}

// ── Moderation (clips.moderate) ──

export interface AwardInput {
  key?: string;
  displayName?: string;
  description?: string | null;
  emoji?: string | null;
  color?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export async function adminListClips(
  status: ClipStatus[] = ['pending'],
  limit?: number,
  offset?: number
): Promise<ClipWithContext[]> {
  try {
    const params = new URLSearchParams();
    if (status.length) params.set('status', status.join(','));
    const response = await axios.get<ClipWithContext[]>(
      `${getApiBaseUrl()}/admin/streamclips/clips${withPagingQuery(params, limit, offset)}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Moderations-Queue konnte nicht geladen werden.');
  }
}

export async function adminSetClipStatus(
  id: string,
  status: ClipStatus,
  rejectionReason?: string
): Promise<Clip> {
  try {
    const response = await axios.patch<Clip>(
      `${getApiBaseUrl()}/admin/streamclips/clips/${encodeURIComponent(id)}`,
      { status, rejectionReason: rejectionReason ?? null },
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Clip-Status konnte nicht gesetzt werden.');
  }
}

export interface BulkModerateResult {
  total: number;
  ok: number;
  results: { id: string; ok: boolean; error?: string }[];
}

export async function adminBulkModerateClips(
  ids: string[],
  status: ClipStatus,
  rejectionReason?: string
): Promise<BulkModerateResult> {
  try {
    const response = await axios.post<BulkModerateResult>(
      `${getApiBaseUrl()}/admin/streamclips/clips/bulk-moderate`,
      { ids, status, rejectionReason: rejectionReason ?? null },
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Bulk-Aktion fehlgeschlagen.');
  }
}

export interface DashboardStats {
  clips: { pending: number; flagged: number; approved: number };
  reports: { open: number };
  blog: { published: number; drafts: number };
  printRequests: { open: number };
  users: { total: number; new30d: number };
  ratings: { last7d: number };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const response = await axios.get<DashboardStats>(
      `${getApiBaseUrl()}/admin/dashboard-stats`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Dashboard-Statistiken konnten nicht geladen werden.');
  }
}

export async function adminListAwards(): Promise<AwardCategory[]> {
  try {
    const response = await axios.get<AwardCategory[]>(`${getApiBaseUrl()}/admin/streamclips/awards`, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Award-Kategorien konnten nicht geladen werden.');
  }
}

export async function adminCreateAward(input: AwardInput): Promise<AwardCategory> {
  try {
    const response = await axios.post<AwardCategory>(
      `${getApiBaseUrl()}/admin/streamclips/awards`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Award-Kategorie konnte nicht angelegt werden.');
  }
}

export async function adminUpdateAward(id: string, input: AwardInput): Promise<AwardCategory> {
  try {
    const response = await axios.patch<AwardCategory>(
      `${getApiBaseUrl()}/admin/streamclips/awards/${encodeURIComponent(id)}`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Award-Kategorie konnte nicht aktualisiert werden.');
  }
}

export async function adminDeleteAward(id: string): Promise<void> {
  try {
    await axios.delete(`${getApiBaseUrl()}/admin/streamclips/awards/${encodeURIComponent(id)}`, AXIOS_OPTIONS);
  } catch (error: unknown) {
    toApiError(error, 'Award-Kategorie konnte nicht gelöscht werden.');
  }
}

export async function adminListReports(
  status: 'open' | 'resolved' | 'dismissed' = 'open',
  limit?: number,
  offset?: number
): Promise<ClipReportWithContext[]> {
  try {
    const params = new URLSearchParams();
    params.set('status', status);
    const response = await axios.get<ClipReportWithContext[]>(
      `${getApiBaseUrl()}/admin/streamclips/reports${withPagingQuery(params, limit, offset)}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Meldungen konnten nicht geladen werden.');
  }
}

export async function adminResolveReport(id: string, status: 'resolved' | 'dismissed'): Promise<void> {
  try {
    await axios.patch(
      `${getApiBaseUrl()}/admin/streamclips/reports/${encodeURIComponent(id)}`,
      { status },
      AXIOS_OPTIONS
    );
  } catch (error: unknown) {
    toApiError(error, 'Meldung konnte nicht bearbeitet werden.');
  }
}

// ── Browse / Suche / Sektions-Mapping ──

export interface TwitchCategory {
  id: string;
  name: string;
  boxArtUrl: string | null;
  section: ClipSection;
  createdAt: string;
  updatedAt: string | null;
  clipCount: number;
}

export interface BrowseCategoryRow {
  gameId: string;
  name: string;
  section: ClipSection | null;
  clips: ClipWithContext[];
}

export interface BrowseAwardRow {
  key: string;
  displayName: string;
  emoji: string | null;
  color: string | null;
  clips: ClipWithContext[];
}

export interface BrowseData {
  byCategory: BrowseCategoryRow[];
  byAward: BrowseAwardRow[];
}

export async function browseClips(): Promise<BrowseData> {
  try {
    const response = await axios.get<BrowseData>(`${getApiBaseUrl()}/clips/browse`, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Übersicht konnte nicht geladen werden.');
  }
}

export type CommentTargetType = 'clip' | 'blog_post';

export interface Comment {
  id: string;
  parentCommentId: string | null;
  targetType: CommentTargetType;
  targetId: string;
  userId: string;
  body: string;
  /** Sekunden im Clip — null für Blog-Comments. */
  timestampSeconds: number | null;
  deletedAt: string | null;
  deletedByUserId: string | null;
  /** Grund bei Moderator-Soft-Delete. Bei Self-Delete null. */
  deletionReason: string | null;
  createdAt: string;
  updatedAt: string | null;
  authorName: string;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  /** Wenn gesetzt: Author ist anonymisiert (Account gelöscht). */
  authorDeletedAt: string | null;
}

/** Backwards-compatibility alias — die alte ClipComment-Form hatte
 *  `clipId` statt `targetId`. Komponenten, die noch nicht migriert
 *  sind, importieren das hier. */
export type ClipComment = Comment;

export async function listClipComments(clipId: string): Promise<Comment[]> {
  try {
    const response = await axios.get<Comment[]>(
      `${getApiBaseUrl()}/clips/${encodeURIComponent(clipId)}/comments`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Kommentare konnten nicht geladen werden.');
  }
}

export async function postClipComment(
  clipId: string,
  body: string,
  timestampSeconds: number | null,
  parentCommentId: string | null = null
): Promise<Comment> {
  try {
    const response = await axios.post<Comment>(
      `${getApiBaseUrl()}/clips/${encodeURIComponent(clipId)}/comments`,
      { body, timestampSeconds, parentCommentId },
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Kommentar konnte nicht gespeichert werden.');
  }
}

export async function listBlogComments(slug: string): Promise<Comment[]> {
  try {
    const response = await axios.get<Comment[]>(
      `${getApiBaseUrl()}/blog/${encodeURIComponent(slug)}/comments`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Kommentare konnten nicht geladen werden.');
  }
}

export async function postBlogComment(
  slug: string,
  body: string,
  parentCommentId: string | null = null
): Promise<Comment> {
  try {
    const response = await axios.post<Comment>(
      `${getApiBaseUrl()}/blog/${encodeURIComponent(slug)}/comments`,
      { body, parentCommentId },
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Kommentar konnte nicht gespeichert werden.');
  }
}

export async function deleteClipComment(commentId: string): Promise<void> {
  try {
    await axios.delete(
      `${getApiBaseUrl()}/comments/${encodeURIComponent(commentId)}`,
      AXIOS_OPTIONS
    );
  } catch (error: unknown) {
    toApiError(error, 'Kommentar konnte nicht gelöscht werden.');
  }
}

/** Soft-Delete durch Moderator mit Begründung (transparent angezeigt). */
export async function moderateDeleteComment(commentId: string, reason: string): Promise<void> {
  try {
    await axios.patch(
      `${getApiBaseUrl()}/comments/${encodeURIComponent(commentId)}/moderate`,
      { reason },
      AXIOS_OPTIONS
    );
  } catch (error: unknown) {
    toApiError(error, 'Moderations-Löschung fehlgeschlagen.');
  }
}

export async function restoreComment(commentId: string): Promise<void> {
  try {
    await axios.patch(
      `${getApiBaseUrl()}/comments/${encodeURIComponent(commentId)}/restore`,
      {},
      AXIOS_OPTIONS
    );
  } catch (error: unknown) {
    toApiError(error, 'Wiederherstellen fehlgeschlagen.');
  }
}

export interface CommentMute {
  userId: string;
  reason: string;
  mutedByUserId: string;
  mutedUntil: string | null;
  createdAt: string;
  userName: string;
  userDisplayName: string | null;
  userAvatarUrl: string | null;
  userDeletedAt: string | null;
}

export async function listCommentMutes(): Promise<CommentMute[]> {
  try {
    const response = await axios.get<CommentMute[]>(
      `${getApiBaseUrl()}/admin/streamclips/mutes`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Mute-Liste konnte nicht geladen werden.');
  }
}

export async function muteUserForComments(
  userId: string,
  reason: string,
  mutedUntil: string | null
): Promise<void> {
  try {
    await axios.post(
      `${getApiBaseUrl()}/admin/streamclips/users/${encodeURIComponent(userId)}/mute`,
      { reason, mutedUntil },
      AXIOS_OPTIONS
    );
  } catch (error: unknown) {
    toApiError(error, 'Mute fehlgeschlagen.');
  }
}

export async function unmuteUserForComments(userId: string): Promise<void> {
  try {
    await axios.delete(
      `${getApiBaseUrl()}/admin/streamclips/users/${encodeURIComponent(userId)}/mute`,
      AXIOS_OPTIONS
    );
  } catch (error: unknown) {
    toApiError(error, 'Unmute fehlgeschlagen.');
  }
}

export interface ClipContributor {
  userId: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  clipCount: number;
  avgScore: number | null;
  topClipId: string | null;
  topClipTitle: string | null;
}

export async function listClipContributors(limit = 25): Promise<ClipContributor[]> {
  try {
    const response = await axios.get<ClipContributor[]>(
      `${getApiBaseUrl()}/clips/contributors?limit=${limit}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Top-Einreicher konnten nicht geladen werden.');
  }
}

export async function listClipsByBroadcaster(
  broadcasterId: string,
  opts: { excludeId?: string; limit?: number } = {}
): Promise<ClipWithContext[]> {
  try {
    const params = new URLSearchParams();
    if (opts.excludeId) params.set('excludeId', opts.excludeId);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    const response = await axios.get<ClipWithContext[]>(
      `${getApiBaseUrl()}/clips/by-broadcaster/${encodeURIComponent(broadcasterId)}${qs ? `?${qs}` : ''}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Weitere Clips konnten nicht geladen werden.');
  }
}

export async function getPersonalClipFeed(limit = 12): Promise<ClipWithContext[]> {
  try {
    const response = await axios.get<ClipWithContext[]>(
      `${getApiBaseUrl()}/clips/feed/foryou?limit=${limit}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, '„Für dich"-Feed konnte nicht geladen werden.');
  }
}

export async function searchClips(q: string): Promise<ClipWithContext[]> {
  try {
    const response = await axios.get<ClipWithContext[]>(
      `${getApiBaseUrl()}/clips/search?q=${encodeURIComponent(q)}`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Suche fehlgeschlagen.');
  }
}

export async function adminListCategories(): Promise<TwitchCategory[]> {
  try {
    const response = await axios.get<TwitchCategory[]>(
      `${getApiBaseUrl()}/admin/streamclips/categories`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Kategorien konnten nicht geladen werden.');
  }
}

export async function adminSetCategorySection(id: string, section: ClipSection): Promise<TwitchCategory> {
  try {
    const response = await axios.patch<TwitchCategory>(
      `${getApiBaseUrl()}/admin/streamclips/categories/${encodeURIComponent(id)}`,
      { section },
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Sektion konnte nicht gesetzt werden.');
  }
}

export interface ModerationSettings {
  autoApproveDailyLimit: number;
  requireReviewAll: boolean;
  reviewSections: ClipSection[];
}

export async function getModerationSettings(): Promise<ModerationSettings> {
  try {
    const response = await axios.get<ModerationSettings>(
      `${getApiBaseUrl()}/admin/streamclips/moderation-settings`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Moderations-Einstellungen konnten nicht geladen werden.');
  }
}

export async function updateModerationSettings(input: Partial<ModerationSettings>): Promise<ModerationSettings> {
  try {
    const response = await axios.put<ModerationSettings>(
      `${getApiBaseUrl()}/admin/streamclips/moderation-settings`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Moderations-Einstellungen konnten nicht gespeichert werden.');
  }
}

export interface ForYouSettings {
  weightMatching: number;
  weightQuality: number;
  weightRecency: number;
  recencyWindowDays: number;
  freshnessPoolDays: number;
  minPositiveScore: number;
}

export async function getForYouSettings(): Promise<ForYouSettings> {
  try {
    const response = await axios.get<ForYouSettings>(
      `${getApiBaseUrl()}/admin/streamclips/foryou-settings`,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, '„Für dich"-Einstellungen konnten nicht geladen werden.');
  }
}

export async function updateForYouSettings(input: Partial<ForYouSettings>): Promise<ForYouSettings> {
  try {
    const response = await axios.put<ForYouSettings>(
      `${getApiBaseUrl()}/admin/streamclips/foryou-settings`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, '„Für dich"-Einstellungen konnten nicht gespeichert werden.');
  }
}
