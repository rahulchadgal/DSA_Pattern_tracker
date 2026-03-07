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

export interface ProgressUpsertPayload {
  handle: string;
  leetcodeId: string;
  completed: boolean;
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

const DEFAULT_API_BASE_URL = 'http://localhost:8888';

const getConfiguredBase = () => {
  const envValue = import.meta.env.VITE_API_BASE_URL?.trim();
  return envValue && envValue.length > 0 ? envValue : DEFAULT_API_BASE_URL;
};

const apiUrl = (path: string) => {
  const base = getConfiguredBase().replace(/\/$/, '');
  if (base.endsWith('/api') && path.startsWith('/api/')) {
    return `${base}${path.slice(4)}`;
  }
  return `${base}${path}`;
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const backendApi = {
  getQuestionsV1: () => apiRequest<QuestionV1Row[]>('/api/v1/questions'),
  getProgress: (handle: string) => apiRequest<ProgressRow[]>(`/api/progress?handle=${encodeURIComponent(handle.toLowerCase())}`),
  upsertProgress: (payload: ProgressUpsertPayload) => apiRequest<ProgressRow>('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }),
  getCustomQuestions: (handle: string) => apiRequest<QuestionV2Row[]>(`/api/v2/questions?customOnly=true&importedByHandle=${encodeURIComponent(handle.toLowerCase())}`),
  upsertQuestion: (payload: QuestionUpsertPayload) => apiRequest<QuestionV2Row>('/api/v2/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
};
