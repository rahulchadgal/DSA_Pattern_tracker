import { getCompanyQuestionBucketsLocal, getCompanyQuestionsLocal, CompanyQuestionBucketRows } from './companyQuestionsLocalProvider';

export interface ProgressRow {
  leetcodeId: string;
  completed: boolean;
  updatedAt: string;
  completedAt?: string | null;
  solutionRichText?: string | null;
  solutionText?: string | null;
  hasSolutionNote?: boolean;
}

export interface SolutionNoteResponse {
  leetcodeId: string;
  solutionRichText: string | null;
  solutionText: string | null;
}

export interface ProgressMetaResponse {
  latestUpdatedAt: string | null;
  rowCount: number;
  completedCount: number;
}

export interface QuestionV2Row {
  leetcodeId: string;
  title: string;
  difficulty: string;
  mainPattern: string;
  subPattern: string;
  link: string;
  metadataJson?: string | null;
}

export interface CompanyQuestionRow {
  questionId: number;
  leetcodeId: string;
  title: string;
  difficulty: string;
  link: string;
  companyName: string;
  bucketMask: number;
}

export interface ProgressUpsertPayload {
  handle?: string;
  leetcodeId: string;
  completed: boolean;
  solutionText?: string | null;
  solutionRichText?: string | null;
  title?: string;
  difficulty?: string;
  link?: string;
  mainPattern?: string;
  subPattern?: string;
  metadataJson?: string | null;
}

export interface QuestionUpsertPayload {
  leetcodeId: string;
  title: string;
  difficulty: string;
  mainPattern: string;
  subPattern: string;
  link: string;
  defaultQuestion: boolean;
  customImported: boolean;
  importedByHandle: string;
  contentType: string;
  metadataJson: string;
}

export interface AuthResponse {
  token: string;
  handle: string;
}

export interface AdminLoginResponse {
  token: string;
}

export interface AdminUserRow {
  handle: string;
  fullName: string;
  disabledAt?: string | null;
  createdAt: string;
  progressCount: number;
  completedCount: number;
}

export interface PerformanceIndexResponse {
  ok: boolean;
  indexes: string[];
}

export interface DatabaseSyncResponse {
  ok: boolean;
  source: 'neon' | 'aiven';
  target: 'neon' | 'aiven';
  users: number;
  questions: number;
  progressRecords: number;
}

const DEFAULT_API_BASE_URL = '';
const API_TIMEOUT_MS = 2500;
const AUTH_API_TIMEOUT_MS = 9000;
const ADMIN_SYNC_TIMEOUT_MS = 30000;
const AUTH_SESSION_KEY = 'dsa-auth-session-v1';
const ADMIN_SESSION_KEY = 'dsa-admin-session-v1';

export type BackendWakeStatus = 'idle' | 'waking' | 'awake';
type WakeStatusListener = (status: BackendWakeStatus) => void;
const wakeStatusListeners = new Set<WakeStatusListener>();

const getConfiguredBase = () => {
  const envValue = import.meta.env.VITE_API_BASE_URL?.trim();
  return envValue && envValue.length > 0 ? envValue : DEFAULT_API_BASE_URL;
};

const apiUrl = (path: string) => {
  const base = getConfiguredBase().replace(/\/$/, '');
  if (!base) {
    return path;
  }
  if (base.endsWith('/api') && path.startsWith('/api/')) {
    return `${base}${path.slice(4)}`;
  }
  return `${base}${path}`;
};

const notifyWakeStatus = (status: BackendWakeStatus) => {
  wakeStatusListeners.forEach((listener) => listener(status));
};

const getStoredToken = (key: string) => {
  if (typeof localStorage === 'undefined') return '';
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}');
    return typeof parsed.token === 'string' ? parsed.token : '';
  } catch {
    return '';
  }
};

const hasStoredToken = (key: string) => getStoredToken(key).length > 0;

const clearStoredToken = (key: string) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
};

const authHeaders = (admin = false): HeadersInit => {
  const token = getStoredToken(admin ? ADMIN_SESSION_KEY : AUTH_SESSION_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const withJson = (body: unknown, admin = false): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...authHeaders(admin) },
  body: JSON.stringify(body)
});

export const subscribeBackendWakeStatus = (listener: WakeStatusListener) => {
  wakeStatusListeners.add(listener);
  return () => wakeStatusListeners.delete(listener);
};

async function apiRequest<T>(path: string, init?: RequestInit, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl(path), { ...init, signal: controller.signal });
    if (!response.ok) {
      let message = `API request failed: ${response.status}`;
      try {
        const payload = await response.json();
        if (payload && typeof payload.error === 'string') {
          message = payload.error;
        }
      } catch {
        // keep the status-based fallback
      }
      throw new Error(message);
    }

    notifyWakeStatus('awake');
    return response.json() as Promise<T>;
  } catch (error) {
    notifyWakeStatus('idle');
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(timeoutMs > API_TIMEOUT_MS ? 'Database is unavailable. Try again shortly.' : 'Sync service is unavailable. Try again shortly.');
    }
    throw error instanceof Error ? error : new Error('API request failed');
  } finally {
    window.clearTimeout(timeout);
  }
}

export const backendApi = {
  authSessionKey: AUTH_SESSION_KEY,
  adminSessionKey: ADMIN_SESSION_KEY,
  hasAuthSession: () => hasStoredToken(AUTH_SESSION_KEY),
  hasAdminSession: () => hasStoredToken(ADMIN_SESSION_KEY),
  clearAuthSession: () => clearStoredToken(AUTH_SESSION_KEY),
  clearAdminSession: () => clearStoredToken(ADMIN_SESSION_KEY),
  register: (payload: { username: string; password: string }) => apiRequest<AuthResponse>('/api/auth', withJson({ ...payload, action: 'register' }), AUTH_API_TIMEOUT_MS),
  login: (payload: { username: string; password: string }) => apiRequest<AuthResponse>('/api/auth', withJson({ ...payload, action: 'login' }), AUTH_API_TIMEOUT_MS),
  me: () => apiRequest<{ handle: string }>('/api/auth?action=me', { headers: authHeaders() }, AUTH_API_TIMEOUT_MS),
  warmDatabase: () => apiRequest<{ status: string }>('/api/health/db', undefined, API_TIMEOUT_MS),
  adminLogin: (adminKey: string) => apiRequest<AdminLoginResponse>('/api/admin', withJson({ adminKey, action: 'login' }), AUTH_API_TIMEOUT_MS),
  getAdminUsers: () => apiRequest<AdminUserRow[]>('/api/admin?action=users', { headers: authHeaders(true) }, AUTH_API_TIMEOUT_MS),
  resetAdminUserPassword: (handle: string, password: string) => apiRequest<{ handle: string }>('/api/admin', withJson({ handle, password, action: 'reset-password' }, true), AUTH_API_TIMEOUT_MS),
  disableAdminUser: (handle: string) => apiRequest<{ handle: string; disabledAt: string }>('/api/admin', withJson({ handle, action: 'disable' }, true), AUTH_API_TIMEOUT_MS),
  enableAdminUser: (handle: string) => apiRequest<{ handle: string; disabledAt: string | null }>('/api/admin', withJson({ handle, action: 'enable' }, true), AUTH_API_TIMEOUT_MS),
  ensurePerformanceIndexes: () => apiRequest<PerformanceIndexResponse>('/api/admin', withJson({ action: 'ensure-indexes' }, true), AUTH_API_TIMEOUT_MS),
  syncDatabases: () => apiRequest<DatabaseSyncResponse>('/api/admin', withJson({ action: 'sync-databases' }, true), ADMIN_SYNC_TIMEOUT_MS),
  getProgress: (_handle?: string) => apiRequest<ProgressRow[]>('/api/progress', { headers: authHeaders() }),
  getProgressMeta: () => apiRequest<ProgressMetaResponse>('/api/progress?meta=true', { headers: authHeaders() }),
  getSolutionNote: (leetcodeId: string) => apiRequest<SolutionNoteResponse>(`/api/progress?leetcodeId=${encodeURIComponent(leetcodeId)}&includeSolution=true`, { headers: authHeaders() }),
  upsertProgress: (payload: ProgressUpsertPayload) => apiRequest<ProgressRow>('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  }),
  getCompanyQuestions: (params?: { company?: string; bucket?: 'all' | '30d' | '3m' | '6m'; search?: string }) =>
    getCompanyQuestionsLocal(params),
  getCompanyQuestionBuckets: (): Promise<CompanyQuestionBucketRows> =>
    getCompanyQuestionBucketsLocal(),
  getCustomQuestions: (_handle?: string) => apiRequest<QuestionV2Row[]>('/api/v2/questions?customOnly=true', { headers: authHeaders() }),
  upsertQuestion: (payload: QuestionUpsertPayload) => apiRequest<QuestionV2Row>('/api/v2/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  })
};
