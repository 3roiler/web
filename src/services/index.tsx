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

export async function listGcodeFiles(): Promise<GcodeFile[]> {
  try {
    const response = await axios.get<GcodeFile[]>(`${getApiBaseUrl()}/gcode`, AXIOS_OPTIONS);
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'G-Code-Dateien konnten nicht geladen werden.');
  }
}

/**
 * Raw body upload via `application/octet-stream` + `X-Filename`. Matches
 * the API's `express.raw` route — we deliberately avoid multipart, since
 * a single raw blob has zero framing overhead and needs no extra deps
 * on either side.
 */
export async function uploadGcodeFile(file: File): Promise<GcodeFile> {
  try {
    const response = await axios.post<GcodeFile>(
      `${getApiBaseUrl()}/gcode`,
      file,
      {
        ...AXIOS_OPTIONS,
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Filename': file.name
        }
      }
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'G-Code-Datei konnte nicht hochgeladen werden.');
  }
}

export async function deleteGcodeFile(id: string): Promise<void> {
  try {
    await axios.delete(`${getApiBaseUrl()}/gcode/${encodeURIComponent(id)}`, AXIOS_OPTIONS);
  } catch (error: unknown) {
    toApiError(error, 'G-Code-Datei konnte nicht gelöscht werden.');
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

export interface CreatePrintRequestInput {
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
 * Contributor+ files a new request. Goes into `requested` state —
 * admin/operator must approve before it joins the queue.
 */
export async function createPrintRequest(
  printerId: string,
  input: CreatePrintRequestInput
): Promise<PrintJob> {
  try {
    const response = await axios.post<PrintJob>(
      `${getApiBaseUrl()}/printer/${encodeURIComponent(printerId)}/jobs`,
      input,
      AXIOS_OPTIONS
    );
    return response.data;
  } catch (error: unknown) {
    toApiError(error, 'Druckanfrage konnte nicht angelegt werden.');
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
