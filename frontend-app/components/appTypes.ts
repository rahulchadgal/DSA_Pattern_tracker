import type { Question } from '../types';

export type ThemeMode = 'dark' | 'light';
export type SyncStatus = 'signed-out' | 'idle' | 'syncing' | 'synced' | 'paused' | 'error';
export type CompanyTimeFilter = 'all' | '30d' | '3m' | '6m';

export interface AppThemeClasses {
  app: string;
  shell: string;
  header: string;
  panel: string;
  panelStrong: string;
  text: string;
  muted: string;
  subtle: string;
  input: string;
}

export interface CompanyMention {
  company: string;
  buckets: CompanyTimeFilter[];
}

export interface SearchQuestionResult {
  question: Question;
  sourceLabels: string[];
  companies: CompanyMention[];
}
