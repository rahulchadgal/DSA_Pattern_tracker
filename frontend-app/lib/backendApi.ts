import { getCompanyQuestionsLocal } from './companyQuestionsLocalProvider';

export interface QuestionV1Row {
  leetcodeId: string;
  title: string;
  difficulty: string;
  mainPattern: string;
  subPattern: string;
  link: string;
}

export interface ProgressRow {
  leetcodeId: string;
  completed: boolean;
  updatedAt: string;
  completedAt?: string | null;
  solutionRichText?: string | null;
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
  handle: string;
  leetcodeId: string;
  completed: boolean;
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

const DEFAULT_API_BASE_URL = '';
const RETRY_DELAYS_MS = [1200, 2500, 4000];

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const notifyWakeStatus = (status: BackendWakeStatus) => {
  wakeStatusListeners.forEach((listener) => listener(status));
};

const isRetriableStatus = (status: number) => {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
};

const isNetworkError = (error: unknown): error is TypeError => error instanceof TypeError;

export const subscribeBackendWakeStatus = (listener: WakeStatusListener) => {
  wakeStatusListeners.add(listener);
  return () => wakeStatusListeners.delete(listener);
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError: unknown = null;
  const maxAttempts = RETRY_DELAYS_MS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const isRetry = attempt > 0;
    if (isRetry) {
      notifyWakeStatus('waking');
    }

    try {
      const response = await fetch(apiUrl(path), init);
      if (!response.ok) {
        if (attempt < maxAttempts - 1 && isRetriableStatus(response.status)) {
          notifyWakeStatus('waking');
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw new Error(`API request failed: ${response.status}`);
      }

      notifyWakeStatus('awake');
      return response.json() as Promise<T>;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1 && isNetworkError(error)) {
        notifyWakeStatus('waking');
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      break;
    }
  }

  notifyWakeStatus('idle');
  throw lastError instanceof Error ? lastError : new Error('API request failed');
}

export const backendApi = {
  getQuestionsV1: () => apiRequest<QuestionV1Row[]>('/api/v1/questions'),
  getProgress: (handle: string) => apiRequest<ProgressRow[]>(`/api/progress?handle=${encodeURIComponent(handle.toLowerCase())}`),
  upsertProgress: (payload: ProgressUpsertPayload) => apiRequest<ProgressRow>('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }),
  getCompanyQuestions: (params?: { company?: string; bucket?: 'all' | '30d' | '3m' | '6m'; search?: string }) =>
    Promise.resolve(getCompanyQuestionsLocal(params)),
  getCustomQuestions: (handle: string) => apiRequest<QuestionV2Row[]>(`/api/v2/questions?customOnly=true&importedByHandle=${encodeURIComponent(handle.toLowerCase())}`),
  upsertQuestion: (payload: QuestionUpsertPayload) => apiRequest<QuestionV2Row>('/api/v2/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
};
