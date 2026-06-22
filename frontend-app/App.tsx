
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Terminal } from 'lucide-react';
import { backendApi, subscribeBackendWakeStatus } from './lib/backendApi';
import type { AdminUserRow, CompanyQuestionRow, ProgressRow, ProgressUpsertPayload, QuestionV2Row } from './lib/backendApi';
import { DSA_DATA } from './constants';
import { useProfileHandle } from './hooks/useProfileHandle';
import { useAppRoute } from './hooks/useAppRoute';
import { getOfficialSolution, OfficialSolutionEntry } from './lib/officialSolutions';
import { Pattern, Question, Section } from './types';
import { AppHeader } from './components/AppHeader';
import { BackgroundDecorations } from './components/BackgroundDecorations';
import { GlobalQuestionSearch } from './components/GlobalQuestionSearch';
import { OfficialSolutionModal } from './components/OfficialSolutionModal';
import { QuestionSearchModal } from './components/QuestionSearchModal';
import { SolutionNoteModal } from './components/SolutionNoteModal';
import { DifficultyBadge } from './components/appUi';
import type { AppThemeClasses, CompanyMention, CompanyTimeFilter, SearchQuestionResult, SyncStatus, ThemeMode } from './components/appTypes';

const LEGACY_LOCAL_CACHE_KEY = 'dsa-completed-v4-map';
const LEGACY_SOLUTION_CACHE_KEY = 'dsa-solution-notes-v1';
const PROGRESS_CACHE_PREFIX = 'dsa-progress-cache-v1';
const SOLUTION_CACHE_PREFIX = 'dsa-solution-notes-v1';
const PENDING_PROGRESS_PREFIX = 'dsa-pending-progress-v1';
const GRID_VIEW_KEY = 'dsa-grid-view-v1';
const COMPANY_VIEW_KEY = 'dsa-company-view-v1';
const LEGACY_CUSTOM_QUESTIONS_CACHE_KEY = 'dsa-custom-questions-v1';
const CUSTOM_QUESTIONS_CACHE_PREFIX = 'dsa-custom-questions-v1';
const ADMIN_SESSION_KEY = 'dsa-admin-session-v1';
const THEME_MODE_KEY = 'dsa-theme-mode-v1';
const DB_SYNC_COOLDOWN_MS = 60_000;
const PROGRESS_FLUSH_DEBOUNCE_MS = 5_000;
const PROGRESS_SYNC_LOCK_PREFIX = 'dsa-progress-sync-lock-v1';
const PROGRESS_SYNC_EVENT_KEY = 'dsa-progress-sync-event-v1';
const PROGRESS_SYNC_LOCK_TTL_MS = 20_000;
const STALE_PROGRESS_REFRESH_MS = 15 * 60_000;

type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';
type AuthMode = 'login' | 'signup' | 'admin';

interface LcMetadata {
  questionId: string;
  title: string;
  difficulty: DifficultyLevel;
  category: string;
  link: string;
}

interface CustomQuestionRow extends LcMetadata {
  sectionId: string;
  patternId: string;
}

interface QuestionProgressMetadata {
  title: string;
  difficulty: DifficultyLevel;
  link: string;
  mainPattern: string;
  subPattern: string;
  metadataJson?: string | null;
}

interface PendingProgressRow {
  completed: boolean;
  solutionText?: string | null;
  solutionRichText?: string | null;
  updatedAt: string;
  metadata?: QuestionProgressMetadata;
}

interface SyllabusReturnState {
  scrollTop: number | null;
  sectionId: string;
  patternId: string;
}

type CompanyBucketSections = Record<CompanyTimeFilter, Section[]>;

const CATEGORY_OPTIONS = [
  'Dynamic Programming',
  'Sliding Window',
  'Graphs',
  'Trees',
  'Binary Search',
  'Greedy',
  'Backtracking',
  'Stacks',
  'Two Pointers',
  'Heaps'
];

const EMPTY_PATTERN: Pattern = { id: '', name: '', questions: [] };
const COMPANY_TIME_FILTERS: Array<[CompanyTimeFilter, string]> = [
  ['all', 'All'],
  ['30d', '30 Days'],
  ['3m', '3 Months'],
  ['6m', '6 Months']
];
const DIFFICULTY_LEVELS: DifficultyLevel[] = ['Easy', 'Medium', 'Hard'];

const SYNC_STATUS_CONFIG = {
  'signed-out': { color: 'bg-slate-600', label: 'Sign in to sync' },
  idle: { color: 'bg-white/40', label: 'Ready to sync' },
  syncing: { color: 'bg-yellow-400', label: 'Sync in progress' },
  synced: { color: 'bg-green-500', label: 'Synced' },
  paused: { color: 'bg-orange-500', label: 'Sync unavailable' },
  error: { color: 'bg-purple-500/25', label: 'Sync failed' }
} satisfies Record<SyncStatus, { color: string; label: string }>;

const emptyCompanyBucketSections = (): CompanyBucketSections => ({
  all: [],
  '30d': [],
  '3m': [],
  '6m': []
});

// --- UTILS ---
const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day}-${month}-${year} / ${pad(hours)}:${minutes} ${ampm}`;
};

const normalizeQuestionId = (id: string | number): string => String(id).trim().replace(/^0+(?=\d)/, '');
const normalizeHandle = (value: string): string => value.trim().toLowerCase();

const userCacheKey = (prefix: string, userHandle: string): string => `${prefix}:${normalizeHandle(userHandle)}`;

const htmlToPlainText = (value: string): string => {
  if (!value) return '';
  const withBreaks = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|pre)>/gi, '\n');
  if (typeof DOMParser !== 'undefined') {
    const parsed = new DOMParser().parseFromString(withBreaks, 'text/html');
    return (parsed.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }
  return withBreaks.replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();
};

const normalizeSolutionText = (value: string): string => {
  return /<\/?[a-z][\s\S]*>/i.test(value) ? htmlToPlainText(value) : value;
};

const normalizeStoredMap = (raw: string | null): Record<string, string> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [id, value]) => {
      acc[normalizeQuestionId(id)] = value;
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const readJsonArray = <T,>(raw: string | null): T[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

const readPendingProgressMap = (raw: string | null): Record<string, PendingProgressRow> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, PendingProgressRow>;
    return Object.entries(parsed).reduce<Record<string, PendingProgressRow>>((acc, [id, row]) => {
      if (!row || typeof row.completed !== 'boolean') return acc;
      acc[normalizeQuestionId(id)] = {
        completed: row.completed,
        ...(Object.prototype.hasOwnProperty.call(row, 'solutionText')
          ? { solutionText: typeof row.solutionText === 'string' ? row.solutionText : null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(row, 'solutionRichText')
          ? { solutionText: typeof row.solutionRichText === 'string' ? normalizeSolutionText(row.solutionRichText) : null }
          : {}),
        updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString(),
        metadata: row.metadata
      };
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const readThemeMode = (): ThemeMode => {
  if (typeof localStorage === 'undefined') return 'neo-glass';
  const saved = localStorage.getItem(THEME_MODE_KEY);
  return saved === 'old-school-classic' || saved === 'neo-glass' ? saved : 'neo-glass';
};

const readUserMapCache = (prefix: string, userHandle: string, legacyKey?: string): Record<string, string> => {
  const normalizedHandle = normalizeHandle(userHandle);
  if (!normalizedHandle) return {};
  const scopedKey = userCacheKey(prefix, normalizedHandle);
  const scopedRaw = localStorage.getItem(scopedKey);
  if (scopedRaw) return normalizeStoredMap(scopedRaw);
  const legacyMap = normalizeStoredMap(legacyKey ? localStorage.getItem(legacyKey) : null);
  if (Object.keys(legacyMap).length > 0) {
    localStorage.setItem(scopedKey, JSON.stringify(legacyMap));
  }
  return legacyMap;
};

const writeUserMapCache = (prefix: string, userHandle: string, value: Record<string, string>) => {
  const normalizedHandle = normalizeHandle(userHandle);
  if (!normalizedHandle) return;
  localStorage.setItem(userCacheKey(prefix, normalizedHandle), JSON.stringify(value));
};

const readUserSolutionCache = (userHandle: string): Record<string, string> => {
  const cached = readUserMapCache(SOLUTION_CACHE_PREFIX, userHandle, LEGACY_SOLUTION_CACHE_KEY);
  return Object.entries(cached).reduce<Record<string, string>>((acc, [id, value]) => {
    acc[id] = normalizeSolutionText(value);
    return acc;
  }, {});
};

const readUserCustomQuestionCache = (userHandle: string): CustomQuestionRow[] => {
  const normalizedHandle = normalizeHandle(userHandle);
  if (!normalizedHandle) return [];
  const scopedKey = userCacheKey(CUSTOM_QUESTIONS_CACHE_PREFIX, normalizedHandle);
  const scopedRaw = localStorage.getItem(scopedKey);
  if (scopedRaw) return readJsonArray<CustomQuestionRow>(scopedRaw);
  const legacyRows = readJsonArray<CustomQuestionRow>(localStorage.getItem(LEGACY_CUSTOM_QUESTIONS_CACHE_KEY));
  if (legacyRows.length > 0) {
    localStorage.setItem(scopedKey, JSON.stringify(legacyRows));
  }
  return legacyRows;
};

const writeUserCustomQuestionCache = (userHandle: string, rows: CustomQuestionRow[]) => {
  const normalizedHandle = normalizeHandle(userHandle);
  if (!normalizedHandle) return;
  localStorage.setItem(userCacheKey(CUSTOM_QUESTIONS_CACHE_PREFIX, normalizedHandle), JSON.stringify(rows));
};

const readUserPendingProgressCache = (userHandle: string): Record<string, PendingProgressRow> => {
  const normalizedHandle = normalizeHandle(userHandle);
  if (!normalizedHandle) return {};
  return readPendingProgressMap(localStorage.getItem(userCacheKey(PENDING_PROGRESS_PREFIX, normalizedHandle)));
};

const writeUserPendingProgressCache = (userHandle: string, rows: Record<string, PendingProgressRow>) => {
  const normalizedHandle = normalizeHandle(userHandle);
  if (!normalizedHandle) return;
  localStorage.setItem(userCacheKey(PENDING_PROGRESS_PREFIX, normalizedHandle), JSON.stringify(rows));
};

const createTabId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const progressSyncLockKey = (userHandle: string) => userCacheKey(PROGRESS_SYNC_LOCK_PREFIX, userHandle);

const tryAcquireProgressSyncLock = (userHandle: string, ownerId: string) => {
  const key = progressSyncLockKey(userHandle);
  const now = Date.now();
  try {
    const current = JSON.parse(localStorage.getItem(key) || '{}') as { ownerId?: string; expiresAt?: number };
    if (current.ownerId && current.ownerId !== ownerId && Number(current.expiresAt || 0) > now) {
      return false;
    }
    localStorage.setItem(key, JSON.stringify({ ownerId, expiresAt: now + PROGRESS_SYNC_LOCK_TTL_MS }));
    return true;
  } catch {
    localStorage.setItem(key, JSON.stringify({ ownerId, expiresAt: now + PROGRESS_SYNC_LOCK_TTL_MS }));
    return true;
  }
};

const releaseProgressSyncLock = (userHandle: string, ownerId: string) => {
  const key = progressSyncLockKey(userHandle);
  try {
    const current = JSON.parse(localStorage.getItem(key) || '{}') as { ownerId?: string };
    if (!current.ownerId || current.ownerId === ownerId) {
      localStorage.removeItem(key);
    }
  } catch {
    localStorage.removeItem(key);
  }
};

const publishProgressSyncEvent = (userHandle: string, items: Array<{ leetcodeId: string; updatedAt: string }>) => {
  localStorage.setItem(PROGRESS_SYNC_EVENT_KEY, JSON.stringify({
    handle: normalizeHandle(userHandle),
    items,
    emittedAt: Date.now()
  }));
};

const cloneSections = (sections: Section[]): Section[] => JSON.parse(JSON.stringify(sections));
const getInitialSections = (): Section[] => cloneSections(DSA_DATA);

const findSectionIdByCategory = (sections: Section[], category: string): string => {
  if (sections.length === 0) return '';
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedCategory = norm(category);

  const exact = sections.find(s => norm(s.title) === normalizedCategory);
  if (exact) return exact.id;

  const inclusive = sections.find(s => {
    const title = norm(s.title);
    return title.includes(normalizedCategory) || normalizedCategory.includes(title);
  });
  if (inclusive) return inclusive.id;

  return sections[0].id;
};

const normalizeDifficulty = (difficulty: string): DifficultyLevel => {
  if (difficulty === 'Easy' || difficulty === 'Medium' || difficulty === 'Hard') {
    return difficulty;
  }
  return 'Medium';
};

const addCustomQuestionToSections = (sections: Section[], customQuestion: CustomQuestionRow): Section[] => {
  const next = cloneSections(sections);
  const sectionIndex = next.findIndex(section => section.id === customQuestion.sectionId);
  if (sectionIndex === -1) return next;

  const customPatternId = `custom-${customQuestion.sectionId}`;
  let pattern = next[sectionIndex].patterns.find(p => p.id === customPatternId);
  if (!pattern) {
    pattern = {
      id: customPatternId,
      name: `AI Added • ${customQuestion.category}`,
      questions: []
    };
    next[sectionIndex].patterns = [pattern, ...next[sectionIndex].patterns];
  }

  const questionId = normalizeQuestionId(customQuestion.questionId);
  const alreadyExists = pattern.questions.some(q => q.id === questionId);
  if (alreadyExists) return next;

  pattern.questions.unshift({
    id: questionId,
    title: customQuestion.title,
    fullTitle: `${questionId}. ${customQuestion.title}`,
    link: customQuestion.link,
    difficulty: customQuestion.difficulty
  });

  return next;
};

const mockClassifyQuestion = async (questionId: string): Promise<LcMetadata> => {
  const normalized = normalizeQuestionId(questionId);
  await new Promise(resolve => setTimeout(resolve, 400));

  const category = Number(normalized) % 3 === 0
    ? 'Dynamic Programming'
    : Number(normalized) % 3 === 1
      ? 'Sliding Window'
      : 'Graphs';

  return {
    questionId: normalized,
    title: `LeetCode Problem ${normalized}`,
    difficulty: Number(normalized) % 2 === 0 ? 'Medium' : 'Easy',
    category,
    link: `https://leetcode.com/problems/${normalized}/`
  };
};


// --- UI HELPERS ---

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isMobile;
};

const isAuthFailure = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message === 'unauthorized' || message.includes('invalid token') || message.includes('expired token');
};

const App: React.FC = () => {
  const { handle, setHandle, showWelcome, setShowWelcome, persistHandle, clearHandle } = useProfileHandle();
  const { isProfile, isRoulette, isSyllabus, goProfile, goSyllabus, goRoulette } = useAppRoute();
  const isMobile = useIsMobile();

  // --- PROGRESS STATE (Map of ID -> Timestamp) ---
  const [completedMap, setCompletedMap] = useState<Record<string, string>>({});
  const [solutionMap, setSolutionMap] = useState<Record<string, string>>({});
  const [solutionNotePresenceMap, setSolutionNotePresenceMap] = useState<Record<string, boolean>>({});
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => handle && backendApi.hasAuthSession() ? 'idle' : 'signed-out');
  const [baseSectionsData, setBaseSectionsData] = useState<Section[]>(() => getInitialSections());
  const [sectionsData, setSectionsData] = useState<Section[]>(() => getInitialSections());
  const [companyBucketSections, setCompanyBucketSections] = useState<CompanyBucketSections>(() => emptyCompanyBucketSections());
  const [selectedPattern, setSelectedPattern] = useState<Pattern>(() => EMPTY_PATTERN);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [randomPick, setRandomPick] = useState<Question | null>(null);
  const [isPickingRandom, setIsPickingRandom] = useState(false);
  const [gridView, setGridView] = useState<'list' | 'small' | 'big'>(() => {
    const saved = localStorage.getItem(GRID_VIEW_KEY);
    return saved === 'list' || saved === 'small' || saved === 'big' ? saved : 'list';
  });
  const [companyView, setCompanyView] = useState<'cards' | 'list'>(() => {
    const saved = localStorage.getItem(COMPANY_VIEW_KEY);
    return saved === 'list' ? 'list' : 'cards';
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemeMode());
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [questionIdInput, setQuestionIdInput] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<LcMetadata | null>(null);
  const [manualCategory, setManualCategory] = useState<string>('Dynamic Programming');
  const [isClassifying, setIsClassifying] = useState(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [isBackendWaking, setIsBackendWaking] = useState(false);
  const [editingSolutionQuestion, setEditingSolutionQuestion] = useState<Question | null>(null);
  const [officialSolutionQuestion, setOfficialSolutionQuestion] = useState<Question | null>(null);
  const [officialSolution, setOfficialSolution] = useState<OfficialSolutionEntry | null>(null);
  const [officialSolutionStatus, setOfficialSolutionStatus] = useState<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle');
  const [officialSolutionView, setOfficialSolutionView] = useState<'question' | 'hint' | 'solution'>('question');
  const [isLoadingSolutionNote, setIsLoadingSolutionNote] = useState(false);
  const [solutionEditorValue, setSolutionEditorValue] = useState('');
  const solutionEditorDirtyRef = useRef(false);
  const loadedEditorQuestionRef = useRef('');
  const pendingProgressRef = useRef<Record<string, PendingProgressRow>>({});
  const progressSyncPromiseRef = useRef<Promise<void> | null>(null);
  const progressFlushPromiseRef = useRef<Promise<void> | null>(null);
  const progressFlushTimerRef = useRef<number | undefined>(undefined);
  const progressFlushHandleRef = useRef('');
  const customSyncPromiseRef = useRef<Promise<void> | null>(null);
  const progressSyncHandleRef = useRef('');
  const customSyncHandleRef = useRef('');
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const syllabusReturnRef = useRef<SyllabusReturnState | null>(null);
  const loadedLocalHandleRef = useRef('');
  const activeHandleRef = useRef(normalizeHandle(handle));
  const tabIdRef = useRef(createTabId());
  const lastProgressRefreshAtRef = useRef(0);
  const lastServerProgressMetaRef = useRef<{ latestUpdatedAt: string | null; rowCount: number; completedCount: number } | null>(null);
  const routeModeRef = useRef(isProfile ? 'companies' : isRoulette ? 'roulette' : 'main');
  const lastDbSyncFailureAtRef = useRef(0);
  const [companyTimeFilter, setCompanyTimeFilter] = useState<CompanyTimeFilter>('all');
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [questionSearchQuery, setQuestionSearchQuery] = useState('');
  const [isQuestionSearchOpen, setIsQuestionSearchOpen] = useState(false);
  const [selectedSearchQuestion, setSelectedSearchQuestion] = useState<SearchQuestionResult | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authUsername, setAuthUsername] = useState(handle);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [adminResetHandle, setAdminResetHandle] = useState('');
  const [adminResetPassword, setAdminResetPassword] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [isAdminBusy, setIsAdminBusy] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => backendApi.hasAdminSession());

  // --- ATOMIC DATABASE OPERATIONS ---

  const clearExpiredUserSession = useCallback((message = 'Your session expired. Please sign in again.') => {
    backendApi.clearAuthSession();
    clearHandle();
    setAuthMode('login');
    setAuthUsername('');
    setAuthPassword('');
    setAuthError(message);
    setSyncStatus('signed-out');
    if (progressFlushTimerRef.current) {
      window.clearTimeout(progressFlushTimerRef.current);
      progressFlushTimerRef.current = undefined;
    }
    pendingProgressRef.current = {};
    loadedLocalHandleRef.current = '';
    progressSyncHandleRef.current = '';
    progressFlushHandleRef.current = '';
    customSyncHandleRef.current = '';
    lastServerProgressMetaRef.current = null;
    setCompletedMap({});
    setSolutionMap({});
    setSolutionNotePresenceMap({});
  }, [clearHandle]);

  useEffect(() => {
    activeHandleRef.current = normalizeHandle(handle);
  }, [handle]);

  useEffect(() => {
    if (handle && backendApi.hasAuthSession()) return;
    setAuthMode('login');
    setShowWelcome(true);
  }, [handle, setShowWelcome]);

  const markDbSyncUnavailable = useCallback(() => {
    lastDbSyncFailureAtRef.current = Date.now();
    setSyncStatus('paused');
  }, []);

  const pullBaseQuestions = useCallback(async () => {
    const nextSections = getInitialSections();
    setBaseSectionsData(nextSections);
    setSectionsData(nextSections);
    setSelectedSectionId('');
    setSelectedPattern(EMPTY_PATTERN);
  }, []);

  const applyCustomRowsToSections = useCallback((rows: CustomQuestionRow[]) => {
    if (baseSectionsData.length === 0) return;
    const merged = rows.reduce((acc, row) => addCustomQuestionToSections(acc, row), cloneSections(baseSectionsData));
    setSectionsData(merged);
  }, [baseSectionsData]);

  const loadUserLocalState = useCallback((userHandle: string) => {
    const normalizedHandle = normalizeHandle(userHandle);
    if (!normalizedHandle) return;
    pendingProgressRef.current = readUserPendingProgressCache(normalizedHandle);
    const cachedCompleted = readUserMapCache(PROGRESS_CACHE_PREFIX, normalizedHandle, LEGACY_LOCAL_CACHE_KEY);
    const cachedSolutions = readUserSolutionCache(normalizedHandle);
    Object.entries(pendingProgressRef.current).forEach(([leetcodeId, pending]) => {
      if (pending.completed) {
        cachedCompleted[leetcodeId] = pending.updatedAt;
      } else {
        delete cachedCompleted[leetcodeId];
      }
      if (pending.solutionText && pending.solutionText.trim().length > 0) {
        cachedSolutions[leetcodeId] = pending.solutionText;
      } else if (pending.solutionText === null) {
        delete cachedSolutions[leetcodeId];
      }
    });
    setCompletedMap(cachedCompleted);
    setSolutionMap(cachedSolutions);
    setSolutionNotePresenceMap(Object.fromEntries(Object.keys(cachedSolutions).map((id) => [id, true])));
    applyCustomRowsToSections(readUserCustomQuestionCache(normalizedHandle));
    loadedLocalHandleRef.current = normalizedHandle;
  }, [applyCustomRowsToSections]);

  const buildPendingProgressPayloads = (pendingRows: Record<string, PendingProgressRow>): ProgressUpsertPayload[] => {
    return Object.entries(pendingRows).map(([leetcodeId, pending]) => ({
      handle: activeHandleRef.current,
      leetcodeId,
      completed: pending.completed,
      ...(Object.prototype.hasOwnProperty.call(pending, 'solutionText') ? { solutionText: pending.solutionText ?? null } : {}),
      title: pending.metadata?.title,
      difficulty: pending.metadata?.difficulty,
      link: pending.metadata?.link,
      mainPattern: pending.metadata?.mainPattern,
      subPattern: pending.metadata?.subPattern,
      metadataJson: pending.metadata?.metadataJson ?? null
    }));
  };

  const mergePendingProgressIntoState = useCallback((normalizedHandle: string, pendingRows: Record<string, PendingProgressRow>) => {
    setCompletedMap(prev => {
      const next = { ...prev };
      Object.entries(pendingRows).forEach(([leetcodeId, pending]) => {
        if (pending.completed) {
          next[leetcodeId] = pending.updatedAt;
        } else {
          delete next[leetcodeId];
        }
      });
      writeUserMapCache(PROGRESS_CACHE_PREFIX, normalizedHandle, next);
      return next;
    });

    setSolutionMap(prev => {
      const next = { ...prev };
      Object.entries(pendingRows).forEach(([leetcodeId, pending]) => {
        if (!Object.prototype.hasOwnProperty.call(pending, 'solutionText')) return;
        if (pending.solutionText && pending.solutionText.trim().length > 0) {
          next[leetcodeId] = pending.solutionText;
        } else {
          delete next[leetcodeId];
        }
      });
      writeUserMapCache(SOLUTION_CACHE_PREFIX, normalizedHandle, next);
      return next;
    });

    setSolutionNotePresenceMap(prev => {
      const next = { ...prev };
      Object.entries(pendingRows).forEach(([leetcodeId, pending]) => {
        if (!Object.prototype.hasOwnProperty.call(pending, 'solutionText')) return;
        if (pending.solutionText && pending.solutionText.trim().length > 0) {
          next[leetcodeId] = true;
        } else {
          delete next[leetcodeId];
        }
      });
      return next;
    });
  }, []);

  const applySavedProgressRows = useCallback((normalizedHandle: string, rows: ProgressRow[], skipPendingIds = new Set<string>()) => {
    if (rows.length === 0) return;

    setCompletedMap(prev => {
      const next = { ...prev };
      rows.forEach((row) => {
        const leetcodeId = normalizeQuestionId(row.leetcodeId);
        if (skipPendingIds.has(leetcodeId)) return;
        if (row.completed) {
          next[leetcodeId] = row.updatedAt;
        } else {
          delete next[leetcodeId];
        }
      });
      writeUserMapCache(PROGRESS_CACHE_PREFIX, normalizedHandle, next);
      return next;
    });

    setSolutionMap(prev => {
      const next = { ...prev };
      rows.forEach((row) => {
        const leetcodeId = normalizeQuestionId(row.leetcodeId);
        if (skipPendingIds.has(leetcodeId)) return;
        const rowSolutionText = row.solutionText || (row.solutionRichText ? normalizeSolutionText(row.solutionRichText) : '');
        if (rowSolutionText && rowSolutionText.trim().length > 0) {
          next[leetcodeId] = rowSolutionText;
        } else if (Object.prototype.hasOwnProperty.call(row, 'solutionText') || Object.prototype.hasOwnProperty.call(row, 'solutionRichText')) {
          delete next[leetcodeId];
        }
      });
      writeUserMapCache(SOLUTION_CACHE_PREFIX, normalizedHandle, next);
      return next;
    });

    setSolutionNotePresenceMap(prev => {
      const next = { ...prev };
      rows.forEach((row) => {
        const leetcodeId = normalizeQuestionId(row.leetcodeId);
        if (skipPendingIds.has(leetcodeId)) return;
        if (row.hasSolutionNote) {
          next[leetcodeId] = true;
        } else if (Object.prototype.hasOwnProperty.call(row, 'solutionText') || Object.prototype.hasOwnProperty.call(row, 'solutionRichText')) {
          delete next[leetcodeId];
        }
      });
      return next;
    });
  }, []);

  const flushPendingProgress = useCallback((userHandle: string) => {
    const normalizedHandle = normalizeHandle(userHandle);
    if (!normalizedHandle || !backendApi.hasAuthSession()) {
      setSyncStatus('signed-out');
      return Promise.resolve();
    }
    if (progressFlushPromiseRef.current && progressFlushHandleRef.current === normalizedHandle) {
      return progressFlushPromiseRef.current;
    }
    if (Date.now() - lastDbSyncFailureAtRef.current < DB_SYNC_COOLDOWN_MS) {
      setSyncStatus('paused');
      return Promise.resolve();
    }
    const cachedPending = readUserPendingProgressCache(normalizedHandle);
    pendingProgressRef.current = { ...cachedPending, ...pendingProgressRef.current };
    const snapshot = { ...pendingProgressRef.current };
    const payloads = buildPendingProgressPayloads(snapshot);
    if (payloads.length === 0) {
      setSyncStatus('synced');
      return Promise.resolve();
    }
    if (!tryAcquireProgressSyncLock(normalizedHandle, tabIdRef.current)) {
      setSyncStatus('paused');
      return Promise.resolve();
    }

    let syncPromise: Promise<void> | null = null;
    syncPromise = (async () => {
      setSyncStatus('syncing');
      try {
        const savedRows = await backendApi.upsertProgressBatch(payloads);
        const latestPending = {
          ...readUserPendingProgressCache(normalizedHandle),
          ...pendingProgressRef.current
        };
        const syncedItems: Array<{ leetcodeId: string; updatedAt: string }> = [];
        savedRows.forEach((row) => {
          const leetcodeId = normalizeQuestionId(row.leetcodeId);
          const sent = snapshot[leetcodeId];
          if (sent && latestPending[leetcodeId]?.updatedAt === sent.updatedAt) {
            delete latestPending[leetcodeId];
            syncedItems.push({ leetcodeId, updatedAt: sent.updatedAt });
          }
        });

        pendingProgressRef.current = latestPending;
        writeUserPendingProgressCache(normalizedHandle, latestPending);
        applySavedProgressRows(normalizedHandle, savedRows, new Set(Object.keys(latestPending)));
        if (syncedItems.length > 0) {
          publishProgressSyncEvent(normalizedHandle, syncedItems);
        }
        setSyncStatus(Object.keys(latestPending).length === 0 ? 'synced' : 'paused');
      } catch (error) {
        if (isAuthFailure(error)) {
          clearExpiredUserSession();
          return;
        }
        lastDbSyncFailureAtRef.current = Date.now();
        setSyncStatus('error');
      } finally {
        releaseProgressSyncLock(normalizedHandle, tabIdRef.current);
        if (syncPromise && progressFlushPromiseRef.current === syncPromise) {
          progressFlushPromiseRef.current = null;
          progressFlushHandleRef.current = '';
        }
      }
    })();

    progressFlushPromiseRef.current = syncPromise;
    progressFlushHandleRef.current = normalizedHandle;
    return syncPromise;
  }, [applySavedProgressRows, clearExpiredUserSession]);

  const schedulePendingProgressFlush = useCallback((userHandle: string, delay = PROGRESS_FLUSH_DEBOUNCE_MS) => {
    const normalizedHandle = normalizeHandle(userHandle);
    if (!normalizedHandle || !backendApi.hasAuthSession()) return;
    if (progressFlushTimerRef.current) {
      window.clearTimeout(progressFlushTimerRef.current);
    }
    progressFlushTimerRef.current = window.setTimeout(() => {
      progressFlushTimerRef.current = undefined;
      flushPendingProgress(normalizedHandle);
    }, delay);
  }, [flushPendingProgress]);

  const pullRelationalProgress = useCallback((userHandle: string) => {
    const normalizedHandle = normalizeHandle(userHandle);
    if (progressSyncPromiseRef.current && progressSyncHandleRef.current === normalizedHandle) {
      return progressSyncPromiseRef.current;
    }
    if (!userHandle || !backendApi.hasAuthSession()) {
      setSyncStatus('signed-out');
      return Promise.resolve();
    }
    if (Date.now() - lastDbSyncFailureAtRef.current < DB_SYNC_COOLDOWN_MS) {
      setSyncStatus('paused');
      return Promise.resolve();
    }

    let syncPromise: Promise<void> | null = null;
    syncPromise = (async () => {
      setSyncStatus('syncing');
      try {
        pendingProgressRef.current = {
          ...readUserPendingProgressCache(normalizedHandle),
          ...pendingProgressRef.current
        };
        const rows = await backendApi.getProgress(userHandle);
        const completionMap: Record<string, string> = {};
        const solutionNotesMap: Record<string, string> = {};
        const notePresenceMap: Record<string, boolean> = {};
        rows.forEach((r) => {
          const leetcodeId = normalizeQuestionId(r.leetcodeId);
          if (r.completed) {
            completionMap[leetcodeId] = r.updatedAt;
          }
          if (r.hasSolutionNote) {
            notePresenceMap[leetcodeId] = true;
          }
          const rowSolutionText = r.solutionText || (r.solutionRichText ? normalizeSolutionText(r.solutionRichText) : '');
          if (rowSolutionText && rowSolutionText.trim().length > 0) {
            solutionNotesMap[leetcodeId] = rowSolutionText;
            notePresenceMap[leetcodeId] = true;
          }
        });
        Object.entries(pendingProgressRef.current).forEach(([leetcodeId, pending]) => {
          if (pending.completed) {
            completionMap[leetcodeId] = pending.updatedAt;
          } else {
            delete completionMap[leetcodeId];
          }
          if (Object.prototype.hasOwnProperty.call(pending, 'solutionText') && pending.solutionText && pending.solutionText.trim().length > 0) {
            solutionNotesMap[leetcodeId] = pending.solutionText;
            notePresenceMap[leetcodeId] = true;
          } else if (Object.prototype.hasOwnProperty.call(pending, 'solutionText') && pending.solutionText === null) {
            delete solutionNotesMap[leetcodeId];
            delete notePresenceMap[leetcodeId];
          }
        });

        if (activeHandleRef.current !== normalizedHandle) return;
        const cachedSolutionNotes = readUserSolutionCache(normalizedHandle);
        const nextSolutionMap = { ...cachedSolutionNotes, ...solutionNotesMap };
        const nextNotePresenceMap = {
          ...Object.fromEntries(Object.keys(cachedSolutionNotes).map((id) => [id, true])),
          ...notePresenceMap
        };
        setCompletedMap(completionMap);
        setSolutionMap(nextSolutionMap);
        setSolutionNotePresenceMap(nextNotePresenceMap);
        writeUserMapCache(PROGRESS_CACHE_PREFIX, normalizedHandle, completionMap);
        writeUserMapCache(SOLUTION_CACHE_PREFIX, normalizedHandle, nextSolutionMap);
        lastProgressRefreshAtRef.current = Date.now();
        lastServerProgressMetaRef.current = {
          latestUpdatedAt: rows.reduce<string | null>((latest, row) => {
            if (!row.updatedAt) return latest;
            return !latest || row.updatedAt > latest ? row.updatedAt : latest;
          }, null),
          rowCount: rows.length,
          completedCount: rows.filter(row => row.completed).length
        };

        setSyncStatus(Object.keys(pendingProgressRef.current).length === 0 ? 'synced' : 'paused');
      } catch (error) {
        if (isAuthFailure(error)) {
          clearExpiredUserSession();
          return;
        }
        markDbSyncUnavailable();
      } finally {
        if (syncPromise && progressSyncPromiseRef.current === syncPromise) {
          progressSyncPromiseRef.current = null;
        }
      }
    })();

    progressSyncPromiseRef.current = syncPromise;
    progressSyncHandleRef.current = normalizedHandle;
    return syncPromise;
  }, [clearExpiredUserSession, markDbSyncUnavailable]);

  const atomicUpdate = async (
    qId: string,
    isChecked: boolean,
    solutionText?: string | null,
    metadata?: QuestionProgressMetadata
  ) => {
    if (!handle || !backendApi.hasAuthSession()) {
      setSyncStatus('signed-out');
      return;
    }
    const leetcodeId = normalizeQuestionId(qId);
    const normalizedHandle = normalizeHandle(handle);
    pendingProgressRef.current[leetcodeId] = {
      completed: isChecked,
      ...(solutionText !== undefined ? { solutionText: solutionText ?? null } : {}),
      updatedAt: new Date().toISOString(),
      metadata
    };
    writeUserPendingProgressCache(normalizedHandle, pendingProgressRef.current);
    mergePendingProgressIntoState(normalizedHandle, pendingProgressRef.current);
    setSyncStatus('syncing');
    schedulePendingProgressFlush(normalizedHandle);
  };


  const saveCustomQuestion = async (question: CustomQuestionRow) => {
    if (!handle) return;
    const questionId = normalizeQuestionId(question.questionId);
    await backendApi.upsertQuestion({
      leetcodeId: questionId,
      title: question.title,
      difficulty: question.difficulty,
      mainPattern: question.category,
      subPattern: question.patternId,
      link: question.link,
      defaultQuestion: false,
      customImported: true,
      importedByHandle: handle.toLowerCase(),
      contentType: 'QUESTION_ONLY',
      metadataJson: JSON.stringify({
        sectionId: question.sectionId,
        patternId: question.patternId,
        source: 'frontend-app'
      })
    });
  };

  const loadAdminUsers = useCallback(async () => {
    setIsAdminBusy(true);
    setAdminMessage('');
    try {
      const rows = await backendApi.getAdminUsers();
      setAdminUsers(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Admin session expired or invalid.';
      setAdminMessage(message);
      if (isAuthFailure(error)) {
        backendApi.clearAdminSession();
        setIsAdminUnlocked(false);
        setAdminUsers([]);
        setAdminMessage('Admin session expired. Enter the admin key again.');
      }
    } finally {
      setIsAdminBusy(false);
    }
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthBusy(true);
    try {
      const username = authUsername.trim().toLowerCase();
      const response = authMode === 'signup'
        ? await backendApi.register({ username, password: authPassword })
        : await backendApi.login({ username, password: authPassword });
      persistHandle(response.handle, response.token);
      setAuthPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setAuthError(message || (authMode === 'signup' ? 'Unable to create account.' : 'Invalid username or password.'));
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthBusy(true);
    try {
      const response = await backendApi.adminLogin(adminKey);
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ token: response.token }));
      setIsAdminUnlocked(true);
      setAdminKey('');
      setAdminMessage('Admin access unlocked.');
      await loadAdminUsers();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Invalid admin key.');
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    setAdminMessage('');
    setIsAdminBusy(true);
    try {
      await backendApi.resetAdminUserPassword(adminResetHandle, adminResetPassword);
      setAdminResetPassword('');
      setAdminMessage(`Password reset for @${adminResetHandle.trim().toLowerCase()}.`);
      await loadAdminUsers();
    } catch {
      backendApi.clearAdminSession();
      setIsAdminUnlocked(false);
      setAdminUsers([]);
      setAdminMessage('Admin session expired. Enter the admin key again.');
    } finally {
      setIsAdminBusy(false);
    }
  };

  const handleEnsurePerformanceIndexes = async () => {
    setAdminMessage('');
    setIsAdminBusy(true);
    try {
      const response = await backendApi.ensurePerformanceIndexes();
      setAdminMessage(`Performance indexes ready: ${response.indexes.join(', ')}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to prepare performance indexes.';
      if (isAuthFailure(error)) {
        backendApi.clearAdminSession();
        setIsAdminUnlocked(false);
        setAdminUsers([]);
        setAdminMessage('Admin session expired. Enter the admin key again.');
      } else {
        setAdminMessage(message);
      }
    } finally {
      setIsAdminBusy(false);
    }
  };

  const handleSyncDatabases = async () => {
    setAdminMessage('');
    setIsAdminBusy(true);
    try {
      const response = await backendApi.syncDatabases();
      setAdminMessage(`Synced ${response.source} -> ${response.target}: ${response.users} users, ${response.questions} questions, ${response.progressRecords} progress rows.`);
      await loadAdminUsers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync databases.';
      if (isAuthFailure(error)) {
        backendApi.clearAdminSession();
        setIsAdminUnlocked(false);
        setAdminUsers([]);
        setAdminMessage('Admin session expired. Enter the admin key again.');
      } else {
        setAdminMessage(message);
      }
    } finally {
      setIsAdminBusy(false);
    }
  };

  const toggleAdminUser = async (row: AdminUserRow) => {
    setAdminMessage('');
    setIsAdminBusy(true);
    try {
      if (row.disabledAt) {
        await backendApi.enableAdminUser(row.handle);
        setAdminMessage(`Enabled @${row.handle}.`);
      } else {
        await backendApi.disableAdminUser(row.handle);
        setAdminMessage(`Disabled @${row.handle}. Progress was preserved.`);
      }
      await loadAdminUsers();
    } catch {
      backendApi.clearAdminSession();
      setIsAdminUnlocked(false);
      setAdminUsers([]);
      setAdminMessage('Admin session expired. Enter the admin key again.');
    } finally {
      setIsAdminBusy(false);
    }
  };

  const logout = () => {
    backendApi.clearAuthSession();
    clearHandle();
    if (progressFlushTimerRef.current) {
      window.clearTimeout(progressFlushTimerRef.current);
      progressFlushTimerRef.current = undefined;
    }
    setAuthUsername('');
    setAuthPassword('');
    setSyncStatus('signed-out');
    setCompletedMap({});
    setSolutionMap({});
    setSolutionNotePresenceMap({});
    pendingProgressRef.current = {};
    loadedLocalHandleRef.current = '';
    progressSyncHandleRef.current = '';
    progressFlushHandleRef.current = '';
    customSyncHandleRef.current = '';
    lastServerProgressMetaRef.current = null;
    setSectionsData(cloneSections(baseSectionsData));
  };

  const pullCustomQuestions = useCallback((userHandle: string) => {
    const normalizedHandle = normalizeHandle(userHandle);
    applyCustomRowsToSections(readUserCustomQuestionCache(normalizedHandle));

    if (customSyncPromiseRef.current && customSyncHandleRef.current === normalizedHandle) {
      return customSyncPromiseRef.current;
    }
    if (!userHandle || !backendApi.hasAuthSession()) {
      setSyncStatus('signed-out');
      return Promise.resolve();
    }
    if (Date.now() - lastDbSyncFailureAtRef.current < DB_SYNC_COOLDOWN_MS) {
      setSyncStatus('paused');
      return Promise.resolve();
    }

    let syncPromise: Promise<void> | null = null;
    syncPromise = (async () => {
      setSyncStatus('syncing');
      try {
        const rows = await backendApi.getCustomQuestions(userHandle);
        const normalizedRows: CustomQuestionRow[] = rows.map((row: QuestionV2Row) => {
          let sectionId = '';
          let patternId = '';
          if (row.metadataJson) {
            try {
              const metadata = JSON.parse(row.metadataJson);
              sectionId = metadata.sectionId || '';
              patternId = metadata.patternId || '';
            } catch {
              // ignore invalid metadata and fall back to pattern mapping
            }
          }
          const inferredSectionId = sectionId || findSectionIdByCategory(baseSectionsData, row.mainPattern);
          const questionId = normalizeQuestionId(row.leetcodeId);
          return {
            questionId,
            title: row.title,
            difficulty: normalizeDifficulty(row.difficulty),
            category: row.mainPattern,
            sectionId: inferredSectionId,
            patternId: patternId || `custom-${inferredSectionId}`,
            link: row.link
          };
        });

        writeUserCustomQuestionCache(normalizedHandle, normalizedRows);
        if (activeHandleRef.current === normalizedHandle) {
          applyCustomRowsToSections(normalizedRows);
          setSyncStatus(Object.keys(pendingProgressRef.current).length === 0 ? 'synced' : 'paused');
        }
      } catch (error) {
        if (isAuthFailure(error)) {
          clearExpiredUserSession();
          return;
        }
        markDbSyncUnavailable();
      } finally {
        if (syncPromise && customSyncPromiseRef.current === syncPromise) {
          customSyncPromiseRef.current = null;
        }
      }
    })();

    customSyncPromiseRef.current = syncPromise;
    customSyncHandleRef.current = normalizedHandle;
    return syncPromise;
  }, [applyCustomRowsToSections, baseSectionsData, clearExpiredUserSession, markDbSyncUnavailable]);

  const buildCompanySectionsFromRows = (rows: CompanyQuestionRow[]): Section[] => {
    const companySectionsMap = new Map<string, Pattern>();
    const companySlug = (company: string) => company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    rows.forEach((row: CompanyQuestionRow) => {
      const company = row.companyName;
      const leetcodeId = normalizeQuestionId(row.leetcodeId);
      let pattern = companySectionsMap.get(company);
      if (!pattern) {
        const slug = companySlug(company);
        pattern = {
          id: `company-${slug}`,
          name: company,
          questions: []
        };
        companySectionsMap.set(company, pattern);
      }
      if (!pattern.questions.some((q) => q.id === leetcodeId)) {
        pattern.questions.push({
          id: leetcodeId,
          title: row.title,
          fullTitle: `${leetcodeId}. ${row.title}`,
          link: row.link,
          difficulty: normalizeDifficulty(row.difficulty)
        });
      }
    });

    return Array.from(companySectionsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([company, pattern]) => ({
        id: `company-${companySlug(company)}`,
        title: company,
        patterns: [pattern]
      }));
  };

  const pullCompanyBucketMetadata = useCallback(async () => {
    try {
      const rowsByBucket = await backendApi.getCompanyQuestionBuckets();
      const nextBuckets = emptyCompanyBucketSections();
      COMPANY_TIME_FILTERS.forEach(([bucket]) => {
        nextBuckets[bucket] = buildCompanySectionsFromRows(rowsByBucket[bucket]);
      });
      setCompanyBucketSections(nextBuckets);
    } catch {
      setCompanyBucketSections(emptyCompanyBucketSections());
    }
  }, []);

  const handleClassifyQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireSignedIn('Please log in before adding questions.')) return;
    if (!questionIdInput.trim()) return;
    setIsClassifying(true);
    const suggestion = await mockClassifyQuestion(questionIdInput);
    setAiSuggestion(suggestion);
    setManualCategory(suggestion.category);
    setIsClassifying(false);
  };

  const handleSaveNewQuestion = async () => {
    if (!requireSignedIn('Please log in before saving questions.')) return;
    if (!aiSuggestion || !handle) return;
    setIsSavingQuestion(true);

    const selectedCategory = CATEGORY_OPTIONS.includes(manualCategory) ? manualCategory : 'Dynamic Programming';
    const sectionId = findSectionIdByCategory(baseSectionsData, selectedCategory) || selectedSectionId;
    if (!sectionId) {
      setIsSavingQuestion(false);
      return;
    }
    const patternId = `custom-${sectionId}`;

    const newRow: CustomQuestionRow = {
      ...aiSuggestion,
      category: selectedCategory,
      sectionId,
      patternId
    };

    setSectionsData(prev => addCustomQuestionToSections(prev, newRow));
    const cachedRows = readUserCustomQuestionCache(handle);
    const deduped = [...cachedRows.filter(row => row.questionId !== newRow.questionId), newRow];
    writeUserCustomQuestionCache(handle, deduped);

    try {
      await saveCustomQuestion(newRow);

      const targetPattern = sectionId === selectedSectionId ? patternId : selectedPattern.id;
      if (targetPattern === patternId) {
        const section = sectionsData.find(s => s.id === sectionId);
        if (section) {
          const nextPattern: Pattern = {
            id: patternId,
            name: `AI Added • ${selectedCategory}`,
            questions: [{
              id: newRow.questionId,
              title: newRow.title,
              fullTitle: `${newRow.questionId}. ${newRow.title}`,
              link: newRow.link,
              difficulty: newRow.difficulty
            }]
          };
          setSelectedPattern(nextPattern);
        }
      }

      setQuestionIdInput('');
      setAiSuggestion(null);
      setShowAddQuestionModal(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync question to database.';
      if (isAuthFailure(error)) {
        clearExpiredUserSession();
        alert('Question was added locally, but your session expired. Please sign in again to sync it.');
        return;
      }
      setAuthError(message);
      alert(`Question was added locally, but DB sync failed: ${message}`);
    } finally {
      setIsSavingQuestion(false);
    }
  };

  // --- SYNC TRIGGERS ---

  useEffect(() => {
    pullBaseQuestions();
  }, [pullBaseQuestions]);

  useEffect(() => {
    pullCompanyBucketMetadata();
  }, [pullCompanyBucketMetadata]);

  useEffect(() => {
    const nextRouteMode = isProfile ? 'companies' : isRoulette ? 'roulette' : 'main';
    if (routeModeRef.current === nextRouteMode) return;
    const previousRouteMode = routeModeRef.current;
    routeModeRef.current = nextRouteMode;

    if (nextRouteMode === 'companies') {
      resetQuestionSelection();
      return;
    }

    if (previousRouteMode === 'companies') {
      resetQuestionSelection();
      setCompanySearchTerm('');
    }
  }, [isProfile, isRoulette]);

  useEffect(() => {
    if (handle) {
      if (loadedLocalHandleRef.current !== normalizeHandle(handle)) {
        loadUserLocalState(handle);
      }
      pullRelationalProgress(handle)
        .then(() => {
          if (Object.keys(pendingProgressRef.current).length > 0) {
            schedulePendingProgressFlush(handle, 0);
          }
        })
        .then(() => pullCustomQuestions(handle));
      return;
    }
    loadedLocalHandleRef.current = '';
    pendingProgressRef.current = {};
    progressSyncHandleRef.current = '';
    progressFlushHandleRef.current = '';
    customSyncHandleRef.current = '';
    lastServerProgressMetaRef.current = null;
    setCompletedMap({});
    setSolutionMap({});
    setSolutionNotePresenceMap({});
    setSectionsData(cloneSections(baseSectionsData));
    setSyncStatus('signed-out');
  }, [handle, loadUserLocalState, pullRelationalProgress, pullCustomQuestions, baseSectionsData, schedulePendingProgressFlush]);

  useEffect(() => {
    if (!handle || !backendApi.hasAuthSession()) return;
    const normalizedHandle = normalizeHandle(handle);

    const refreshIfStale = async () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastProgressRefreshAtRef.current < STALE_PROGRESS_REFRESH_MS) return;
      if (progressSyncPromiseRef.current || progressFlushPromiseRef.current) return;
      if (Object.keys(pendingProgressRef.current).length > 0) {
        schedulePendingProgressFlush(normalizedHandle, 0);
        return;
      }
      if (Date.now() - lastDbSyncFailureAtRef.current < DB_SYNC_COOLDOWN_MS) return;

      try {
        if (activeHandleRef.current !== normalizedHandle) return;
        await pullRelationalProgress(normalizedHandle);
      } catch (error) {
        if (isAuthFailure(error)) {
          clearExpiredUserSession();
          return;
        }
        markDbSyncUnavailable();
      }
    };

    document.addEventListener('visibilitychange', refreshIfStale);
    window.addEventListener('focus', refreshIfStale);
    return () => {
      document.removeEventListener('visibilitychange', refreshIfStale);
      window.removeEventListener('focus', refreshIfStale);
    };
  }, [handle, pullRelationalProgress, clearExpiredUserSession, markDbSyncUnavailable, schedulePendingProgressFlush]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PROGRESS_SYNC_EVENT_KEY || !event.newValue || !handle) return;
      let payload: { handle?: string; items?: Array<{ leetcodeId?: string; updatedAt?: string }> };
      try {
        payload = JSON.parse(event.newValue);
      } catch {
        return;
      }
      const normalizedHandle = normalizeHandle(handle);
      if (payload.handle !== normalizedHandle || !Array.isArray(payload.items)) return;

      const latestPending = {
        ...readUserPendingProgressCache(normalizedHandle),
        ...pendingProgressRef.current
      };
      let changed = false;
      payload.items.forEach((item) => {
        const leetcodeId = normalizeQuestionId(item.leetcodeId || '');
        if (!leetcodeId || !item.updatedAt) return;
        if (latestPending[leetcodeId]?.updatedAt === item.updatedAt) {
          delete latestPending[leetcodeId];
          changed = true;
        }
      });
      if (!changed) return;
      pendingProgressRef.current = latestPending;
      writeUserPendingProgressCache(normalizedHandle, latestPending);
      setSyncStatus(Object.keys(latestPending).length === 0 ? 'synced' : 'paused');
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [handle]);

  useEffect(() => {
    return () => {
      if (progressFlushTimerRef.current) {
        window.clearTimeout(progressFlushTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (handle && loadedLocalHandleRef.current === normalizeHandle(handle)) {
      applyCustomRowsToSections(readUserCustomQuestionCache(handle));
    }
  }, [baseSectionsData, handle, applyCustomRowsToSections]);

  useEffect(() => {
    localStorage.setItem(GRID_VIEW_KEY, gridView);
  }, [gridView]);

  useEffect(() => {
    localStorage.setItem(COMPANY_VIEW_KEY, companyView);
  }, [companyView]);

  useEffect(() => {
    localStorage.setItem(THEME_MODE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    let hideWakeTimer: number | undefined;
    const unsubscribe = subscribeBackendWakeStatus((status) => {
      if (hideWakeTimer) {
        window.clearTimeout(hideWakeTimer);
      }
      if (status === 'waking') {
        setIsBackendWaking(true);
        return;
      }
      if (status === 'awake') {
        hideWakeTimer = window.setTimeout(() => setIsBackendWaking(false), 1200);
        return;
      }
      setIsBackendWaking(false);
    });
    return () => {
      if (hideWakeTimer) {
        window.clearTimeout(hideWakeTimer);
      }
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!editingSolutionQuestion) return;
    const questionId = normalizeQuestionId(editingSolutionQuestion.id);
    if (loadedEditorQuestionRef.current === questionId) return;
    solutionEditorDirtyRef.current = false;
    loadedEditorQuestionRef.current = questionId;
    setSolutionEditorValue(solutionMap[questionId] || '');
  }, [editingSolutionQuestion]);

  useEffect(() => {
    if (!editingSolutionQuestion || !handle || !backendApi.hasAuthSession()) return;
    const questionId = normalizeQuestionId(editingSolutionQuestion.id);
    if (solutionMap[questionId] || !solutionNotePresenceMap[questionId]) return;

    let cancelled = false;
    setIsLoadingSolutionNote(true);
    backendApi.getSolutionNote(questionId)
      .then((response) => {
        if (cancelled) return;
        const note = response.solutionText || (response.solutionRichText ? normalizeSolutionText(response.solutionRichText) : '');
        if (note.trim().length === 0) {
          setSolutionNotePresenceMap(prev => {
            const next = { ...prev };
            delete next[questionId];
            return next;
          });
          return;
        }
        setSolutionMap(prev => {
          const next = { ...prev, [questionId]: note };
          writeUserMapCache(SOLUTION_CACHE_PREFIX, handle, next);
          return next;
        });
        if (!solutionEditorDirtyRef.current && loadedEditorQuestionRef.current === questionId) {
          setSolutionEditorValue(note);
        }
        setSolutionNotePresenceMap(prev => ({ ...prev, [questionId]: true }));
      })
      .catch((error) => {
        if (isAuthFailure(error)) {
          clearExpiredUserSession();
        } else {
          markDbSyncUnavailable();
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSolutionNote(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editingSolutionQuestion, handle, solutionMap, solutionNotePresenceMap, clearExpiredUserSession, markDbSyncUnavailable]);

  // --- HANDLERS ---

  const buildProgressMetadata = (question: Question): QuestionProgressMetadata => {
    const activeSection = selectedSection || displayedSections.find((section) => section.id === selectedSectionId);
    if (isProfile) {
      const companyName = activeSection?.title || 'Company';
      return {
        title: question.title,
        difficulty: question.difficulty,
        link: question.link,
        mainPattern: 'Company',
        subPattern: companyName,
        metadataJson: JSON.stringify({ company: companyName, source: 'local-company-bank' })
      };
    }
    return {
      title: question.title,
      difficulty: question.difficulty,
      link: question.link,
      mainPattern: activeSection?.title || 'General',
      subPattern: selectedPattern.name || 'General Pattern'
    };
  };

  const requireSignedIn = (message = 'Please log in to save progress and notes.') => {
    if (handle && backendApi.hasAuthSession()) return true;
    setAuthMode('login');
    setAuthError(message);
    setShowWelcome(true);
    setSyncStatus('signed-out');
    return false;
  };

  const toggleQuestion = (question: Question) => {
    if (!requireSignedIn('Please log in before marking questions.')) return;
    const questionId = normalizeQuestionId(question.id);
    const isNowChecked = !completedMap[questionId];
    const timestamp = new Date().toISOString();
    const nextMap = { ...completedMap };
    
    if (isNowChecked) {
      nextMap[questionId] = timestamp;
    } else {
      delete nextMap[questionId];
    }
    
    setCompletedMap(nextMap);
    if (handle && backendApi.hasAuthSession()) {
      writeUserMapCache(PROGRESS_CACHE_PREFIX, handle, nextMap);
      atomicUpdate(questionId, isNowChecked, undefined, buildProgressMetadata(question));
    } else {
      setSyncStatus('signed-out');
    }
  };

  const openSolutionEditor = (question: Question) => {
    if (!requireSignedIn('Please log in before editing solution notes.')) return;
    setEditingSolutionQuestion(question);
  };

  const closeSolutionEditor = () => {
    setEditingSolutionQuestion(null);
    solutionEditorDirtyRef.current = false;
    loadedEditorQuestionRef.current = '';
    setSolutionEditorValue('');
  };

  const openOfficialSolution = async (question: Question) => {
    setOfficialSolutionQuestion(question);
    setOfficialSolution(null);
    setOfficialSolutionStatus('loading');
    setOfficialSolutionView('question');
    try {
      const entry = await getOfficialSolution(question.id);
      setOfficialSolution(entry);
      setOfficialSolutionStatus(entry ? 'ready' : 'missing');
    } catch {
      setOfficialSolutionStatus('error');
    }
  };

  const closeOfficialSolution = () => {
    setOfficialSolutionQuestion(null);
    setOfficialSolution(null);
    setOfficialSolutionStatus('idle');
    setOfficialSolutionView('question');
  };

  const hasMeaningfulHint = (solution: OfficialSolutionEntry) => {
    const normalized = solution.solutionMarkdown
      .replace(/^#{1,6}\s*Solution\s*\d*[:\s-]*/gim, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/[#*_`>\-[\]()]/g, '')
      .trim();
    return normalized.length > 24;
  };

  const handleSolutionEditorChange = (value: string) => {
    solutionEditorDirtyRef.current = true;
    setSolutionEditorValue(value);
  };

  const saveSolutionNote = async () => {
    if (!editingSolutionQuestion) return;
    if (!requireSignedIn('Please log in before saving solution notes.')) return;

    const questionId = normalizeQuestionId(editingSolutionQuestion.id);
    const nextText = solutionEditorValue.trim();
    const nextMap = { ...solutionMap };
    if (nextText) {
      nextMap[questionId] = solutionEditorValue;
      setSolutionNotePresenceMap(prev => ({ ...prev, [questionId]: true }));
    } else {
      delete nextMap[questionId];
      setSolutionNotePresenceMap(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
    setSolutionMap(nextMap);

    if (handle) {
      writeUserMapCache(SOLUTION_CACHE_PREFIX, handle, nextMap);
      await atomicUpdate(questionId, Boolean(completedMap[questionId]), nextText ? solutionEditorValue : null, buildProgressMetadata(editingSolutionQuestion));
    }

    closeSolutionEditor();
  };

  const setupHandle = (e: React.FormEvent) => {
    e.preventDefault();
    handleAuthSubmit(e);
  };

  // --- SEARCH LOGIC ---

  const pickRandom = (scope: 'section' | 'global') => {
    let pool: Question[] = [];
    if (scope === 'section') {
      if (!selectedSectionId) {
        alert("Select a section first.");
        return;
      }
      const section = sectionsData.find(s => s.id === selectedSectionId);
      section?.patterns.forEach(p => p.questions.forEach(q => {
        if (!completedMap[q.id]) pool.push(q);
      }));
    } else {
      sectionsData.forEach(s => s.patterns.forEach(p => p.questions.forEach(q => {
        if (!completedMap[q.id]) pool.push(q);
      })));
    }

    if (pool.length > 0) {
      const nextPick = pool[Math.floor(Math.random() * pool.length)];
      setIsPickingRandom(true);
      window.setTimeout(() => {
        setRandomPick(nextPick);
        setIsPickingRandom(false);
      }, 420);
    } else {
      alert("Mission Accomplished! No unsolved questions found in this scope.");
    }
  };

  // --- STATS ---

  const sectionStats = useMemo(() => {
    return sectionsData.map(section => {
      let total = 0;
      let solved = 0;
      section.patterns.forEach(p => p.questions.forEach(q => {
        total++;
        if (completedMap[q.id]) solved++;
      }));
      return { id: section.id, title: section.title, solved, total };
    });
  }, [completedMap, sectionsData]);

  const currentSectionData = useMemo(() => {
    return sectionStats.find(s => s.id === selectedSectionId);
  }, [sectionStats, selectedSectionId]);

  const globalStats = useMemo(() => {
    const stats: Record<string, { total: number; solved: number }> = {
      Easy: { total: 0, solved: 0 }, Medium: { total: 0, solved: 0 }, Hard: { total: 0, solved: 0 }
    };
    sectionsData.forEach(s => s.patterns.forEach(p => p.questions.forEach(q => {
      if (stats[q.difficulty]) {
        stats[q.difficulty].total++;
        if (completedMap[q.id]) stats[q.difficulty].solved++;
      }
    })));
    return stats;
  }, [completedMap, sectionsData]);

  const totalQuestions = useMemo(() => {
    return sectionsData.reduce((sum, section) => (
      sum + section.patterns.reduce((patternSum, pattern) => patternSum + pattern.questions.length, 0)
    ), 0);
  }, [sectionsData]);

  const filteredAdminUsers = useMemo(() => {
    const search = adminSearchTerm.trim().toLowerCase();
    if (!search) return adminUsers;
    return adminUsers.filter((user) => user.handle.toLowerCase().includes(search));
  }, [adminSearchTerm, adminUsers]);

  const overallPercent = totalQuestions > 0
    ? Math.round((Object.keys(completedMap).length / totalQuestions) * 100)
    : 0;

  const displayedSections = useMemo(() => {
    if (!isProfile) return sectionsData;
    const search = companySearchTerm.trim().toLowerCase();
    const bucketSections = companyBucketSections[companyTimeFilter] || [];
    if (!search) return bucketSections;
    return bucketSections.filter((section) => section.title.toLowerCase().includes(search));
  }, [isProfile, sectionsData, companyBucketSections, companySearchTerm, companyTimeFilter]);

  const filteredPatternQuestions = useMemo(() => {
    if (displayedSections.length === 0) {
      return [];
    }
    const activeSection = displayedSections.find((section) => section.id === selectedSectionId);
    const activePattern = activeSection?.patterns.find((pattern) => pattern.id === selectedPattern.id);
    return activePattern?.questions || [];
  }, [displayedSections, selectedPattern.id, selectedSectionId]);

  const selectedSection = useMemo(() => {
    const current = displayedSections.find((section) => section.id === selectedSectionId);
    if (current || !isProfile) return current;
    return companyBucketSections.all.find((section) => section.id === selectedSectionId);
  }, [companyBucketSections.all, displayedSections, isProfile, selectedSectionId]);

  const hasActiveQuestionSelection = Boolean(selectedSectionId && selectedPattern.id);

  const companySummaries = useMemo(() => {
    const search = companySearchTerm.trim().toLowerCase();
    const allSections = companyBucketSections.all || [];
    return allSections
      .filter((section) => !search || section.title.toLowerCase().includes(search))
      .map((section) => {
        const bucketCounts = COMPANY_TIME_FILTERS.reduce<Record<CompanyTimeFilter, number>>((acc, [bucket]) => {
          const bucketSection = companyBucketSections[bucket].find((item) => item.id === section.id);
          acc[bucket] = bucketSection?.patterns[0]?.questions.length || 0;
          return acc;
        }, { all: 0, '30d': 0, '3m': 0, '6m': 0 });
        const activeSection = companyTimeFilter === 'all'
          ? section
          : companyBucketSections[companyTimeFilter].find((item) => item.id === section.id);
        const activeQuestions = activeSection?.patterns[0]?.questions || [];
        const allQuestions = section.patterns[0]?.questions || [];
        const solvedActive = activeQuestions.filter((q) => completedMap[q.id]).length;
        const activeCount = activeQuestions.length;
        const difficultyTotals = DIFFICULTY_LEVELS.reduce<Record<DifficultyLevel, number>>((acc, difficulty) => {
          acc[difficulty] = activeQuestions.filter((question) => question.difficulty === difficulty).length;
          return acc;
        }, { Easy: 0, Medium: 0, Hard: 0 });
        const difficultySolved = DIFFICULTY_LEVELS.reduce<Record<DifficultyLevel, number>>((acc, difficulty) => {
          acc[difficulty] = activeQuestions.filter((question) => question.difficulty === difficulty && completedMap[question.id]).length;
          return acc;
        }, { Easy: 0, Medium: 0, Hard: 0 });
        return {
          section,
          activeSection,
          pattern: section.patterns[0] || EMPTY_PATTERN,
          activeQuestions,
          allQuestions,
          bucketCounts,
          activeCount,
          allCount: bucketCounts.all,
          solvedActive,
          remainingActive: Math.max(0, activeCount - solvedActive),
          activePct: activeCount > 0 ? Math.round((solvedActive / activeCount) * 100) : 0,
          difficultyTotals,
          difficultySolved
        };
      })
      .filter((summary) => companyTimeFilter === 'all' || summary.activeCount > 0);
  }, [companyBucketSections, companySearchTerm, companyTimeFilter, completedMap]);

  const companiesByQuestionId = useMemo(() => {
    const bucketOrder = COMPANY_TIME_FILTERS.map(([bucket]) => bucket);
    const byQuestion = new Map<string, Map<string, Set<CompanyTimeFilter>>>();

    COMPANY_TIME_FILTERS.forEach(([bucket]) => {
      companyBucketSections[bucket].forEach((section) => {
        section.patterns.forEach((pattern) => {
          pattern.questions.forEach((question) => {
            const questionId = normalizeQuestionId(question.id);
            let companyMap = byQuestion.get(questionId);
            if (!companyMap) {
              companyMap = new Map<string, Set<CompanyTimeFilter>>();
              byQuestion.set(questionId, companyMap);
            }

            const buckets = companyMap.get(section.title) || new Set<CompanyTimeFilter>();
            buckets.add(bucket);
            companyMap.set(section.title, buckets);
          });
        });
      });
    });

    return new Map(Array.from(byQuestion.entries()).map(([questionId, companyMap]) => [
      questionId,
      Array.from(companyMap.entries())
        .map(([company, buckets]) => ({
          company,
          buckets: Array.from(buckets).sort((a, b) => bucketOrder.indexOf(a) - bucketOrder.indexOf(b))
        }))
        .sort((a, b) => a.company.localeCompare(b.company))
    ]));
  }, [companyBucketSections]);

  const allQuestionSearchItems = useMemo(() => {
    const byId = new Map<string, { question: Question; sourceLabels: Set<string> }>();
    const addQuestion = (question: Question, sourceLabel: string) => {
      const questionId = normalizeQuestionId(question.id);
      const existing = byId.get(questionId);
      if (existing) {
        existing.sourceLabels.add(sourceLabel);
        return;
      }
      byId.set(questionId, {
        question: { ...question, id: questionId },
        sourceLabels: new Set([sourceLabel])
      });
    };

    sectionsData.forEach((section) => {
      section.patterns.forEach((pattern) => {
        pattern.questions.forEach((question) => addQuestion(question, `${section.title} / ${pattern.name}`));
      });
    });

    companyBucketSections.all.forEach((section) => {
      section.patterns.forEach((pattern) => {
        pattern.questions.forEach((question) => addQuestion(question, 'Company bank'));
      });
    });

    return Array.from(byId.values()).sort((a, b) => Number(a.question.id) - Number(b.question.id));
  }, [companyBucketSections.all, sectionsData]);

  const questionSearchResults = useMemo<SearchQuestionResult[]>(() => {
    const rawQuery = questionSearchQuery.trim();
    if (!rawQuery) return [];

    const query = rawQuery.toLowerCase();
    const normalizedQuery = normalizeQuestionId(rawQuery).toLowerCase();

    return allQuestionSearchItems
      .map((item) => {
        const id = item.question.id.toLowerCase();
        const title = item.question.title.toLowerCase();
        const fullTitle = item.question.fullTitle.toLowerCase();
        let score: number | null = null;

        if (id === normalizedQuery) score = 0;
        else if (id.startsWith(normalizedQuery)) score = 1;
        else if (title.startsWith(query)) score = 2;
        else if (title.includes(query)) score = 3;
        else if (fullTitle.includes(query)) score = 4;

        if (score === null) return null;

        return {
          score,
          question: item.question,
          sourceLabels: Array.from(item.sourceLabels),
          companies: companiesByQuestionId.get(item.question.id) || []
        };
      })
      .filter((item): item is SearchQuestionResult & { score: number } => Boolean(item))
      .sort((a, b) => a.score - b.score || Number(a.question.id) - Number(b.question.id))
      .slice(0, 8)
      .map(({ score: _score, ...item }) => item);
  }, [allQuestionSearchItems, companiesByQuestionId, questionSearchQuery]);

  const openSearchQuestion = (result: SearchQuestionResult) => {
    setSelectedSearchQuestion(result);
    setIsQuestionSearchOpen(false);
  };

  const closeSearchQuestion = () => {
    setSelectedSearchQuestion(null);
  };

  const resetQuestionSelection = () => {
    setSelectedSectionId('');
    setSelectedPattern(EMPTY_PATTERN);
  };

  const goToCompaniesView = () => {
    resetQuestionSelection();
    goProfile();
  };

  const goToSyllabusView = () => {
    resetQuestionSelection();
    setCompanySearchTerm('');
    goSyllabus();
  };

  const goToRouletteView = () => {
    resetQuestionSelection();
    setCompanySearchTerm('');
    goRoulette();
  };

  const restoreSyllabusPickerScroll = () => {
    const returnState = syllabusReturnRef.current;
    if (!returnState) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scroller = mainScrollRef.current;
        if (!scroller) return;

        if (returnState.scrollTop !== null) {
          scroller.scrollTo({ top: returnState.scrollTop, behavior: 'auto' });
        } else {
          const target = Array.from(scroller.querySelectorAll<HTMLElement>('[data-pattern-id]'))
            .find((element) => element.dataset.sectionId === returnState.sectionId && element.dataset.patternId === returnState.patternId);
          target?.scrollIntoView({ block: 'center' });
        }

        syllabusReturnRef.current = null;
      });
    });
  };

  const selectPattern = (section: Section, pattern: Pattern) => {
    syllabusReturnRef.current = {
      scrollTop: mainScrollRef.current?.scrollTop ?? null,
      sectionId: section.id,
      patternId: pattern.id
    };
    setSelectedSectionId(section.id);
    setSelectedPattern(pattern);
    goSyllabus();
  };

  const selectCompany = (section: Section) => {
    const pattern = section.patterns[0] || EMPTY_PATTERN;
    setSelectedSectionId(section.id);
    setSelectedPattern(pattern);
    goProfile();
  };

  const backToPatternPicker = () => {
    setSelectedSectionId('');
    setSelectedPattern(EMPTY_PATTERN);
    restoreSyllabusPickerScroll();
  };

  const backToCompanyPicker = () => {
    setSelectedSectionId('');
    setSelectedPattern(EMPTY_PATTERN);
  };

  const isOldSchool = themeMode === 'old-school-classic';
  const theme: AppThemeClasses = isOldSchool
    ? {
        app: 'theme-old-school-classic old-school-bg text-[#d5ded8]',
        shell: 'glass-card',
        header: 'old-school-header border-[#aabdb0]/15 bg-[#071012]/90 backdrop-blur-md',
        logo: 'border border-[#aabdb0]/14 bg-[#162520]/70 text-[#b8d9bf] shadow-none',
        brand: 'text-[#e2e9e4]',
        title: 'text-[#e2e9e4]',
        panel: 'glass-card',
        panelStrong: 'glass-panel',
        activeControl: 'border border-[#b8cdbd]/5 bg-white/[0.035] text-[#e2e9e4] shadow-[inset_0_-2px_0_rgba(142,201,155,0.92)]',
        iconTile: 'border border-[#a7cdb0]/20 bg-[#8bbe97]/16 text-[#d1ead4] shadow-none',
        text: 'text-[#e2e9e4]',
        muted: 'text-[#8f9d93]',
        subtle: 'text-[#bec9c1]',
        input: 'glass-input placeholder:text-[#7d8d83]'
      }
    : {
        app: 'theme-neo-glass gradient-bg text-[#F8FAFC]',
        shell: 'glass-card',
        header: 'border-white/10 bg-[#081229]/86 backdrop-blur-2xl',
        logo: 'bg-gradient-to-br from-purple-400 to-violet-700 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)]',
        brand: 'text-[#F8FAFC]',
        title: 'text-[#F8FAFC]',
        panel: 'glass-card',
        panelStrong: 'glass-panel',
        activeControl: 'bg-purple-500/25 text-white shadow-lg shadow-purple-600/20',
        iconTile: 'bg-gradient-to-br from-purple-400 to-violet-700 text-white shadow-[0_0_40px_rgba(168,85,247,0.38)]',
        text: 'text-[#F8FAFC]',
        muted: 'text-[#94A3B8]',
        subtle: 'text-[#CBD5E1]',
        input: 'glass-input placeholder:text-[#94A3B8]'
      };

  const toggleThemeMode = () => {
    setThemeMode((current) => current === 'old-school-classic' ? 'neo-glass' : 'old-school-classic');
  };

  const handleSyncStatusClick = () => {
    if (!handle || !backendApi.hasAuthSession()) {
      setAuthMode('login');
      setShowWelcome(true);
      return;
    }
    const normalizedHandle = normalizeHandle(handle);
    const pendingRows = {
      ...readUserPendingProgressCache(normalizedHandle),
      ...pendingProgressRef.current
    };
    const shouldRetrySync = Object.keys(pendingRows).length > 0 || syncStatus === 'error' || syncStatus === 'paused';
    if (!shouldRetrySync) {
      setAuthMode('login');
      setShowWelcome(true);
      return;
    }
    lastDbSyncFailureAtRef.current = 0;
    flushPendingProgress(handle);
  };

  const renderQuestionGrid = (showCompanyFilters: boolean) => (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button
          onClick={showCompanyFilters ? backToCompanyPicker : backToPatternPicker}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${theme.panelStrong} ${theme.subtle} hover:text-purple-400`}
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.muted}`}>{showCompanyFilters ? selectedSection?.title || 'Company' : selectedPattern.name || 'Pattern'}</span>
        <div className={`flex p-1 rounded-2xl border shadow-inner ${theme.panelStrong}`}>
          {([
            ['list', 'Compact'],
            ['small', 'Tiles'],
            ['big', 'Focus']
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setGridView(mode)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${gridView === mode ? theme.activeControl : `${theme.muted} hover:text-purple-400`}`}
            >
              {label}
            </button>
          ))}
        </div>
        {showCompanyFilters && (
          <div className={`flex p-1 rounded-2xl border shadow-inner ${theme.panelStrong}`}>
            {COMPANY_TIME_FILTERS.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setCompanyTimeFilter(value)}
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${companyTimeFilter === value ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : `${theme.muted} hover:text-green-400`}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {filteredPatternQuestions.length === 0 ? (
        <div className={`rounded-3xl border p-10 text-center ${theme.panel}`}>
          <p className={`text-sm font-bold ${theme.subtle}`}>No questions found for this selection and time range.</p>
        </div>
      ) : (
      <div className={`pb-32 ${gridView === 'list' ? 'grid grid-cols-1 gap-2 max-w-5xl' : gridView === 'small' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'}`}>
        {filteredPatternQuestions.map(q => {
          const timestamp = completedMap[q.id];
          const done = !!timestamp;
          const hasSolution = Boolean(solutionNotePresenceMap[q.id] || (solutionMap[q.id] && solutionMap[q.id].trim().length > 0));
          const neutralCardClass = showCompanyFilters
            ? (done ? 'glass-card border-green-400/25' : 'glass-card hover:border-purple-400/40')
            : (done ? 'glass-card border-green-400/25 shadow-lg shadow-green-500/5' : 'glass-card hover:border-purple-400/40');
          const isCompact = gridView === 'list';
          return (
            <div key={q.id} className={`group relative border transition-all duration-300 hover-lift ${isCompact ? 'min-h-[68px] rounded-[20px] p-3' : gridView === 'small' ? 'h-[132px] rounded-[20px] p-4' : 'h-[174px] rounded-[20px] p-5'} ${neutralCardClass}`}>
              <div className={`flex h-full ${isCompact ? 'items-center gap-3' : 'flex-col gap-3'}`}>
                <div className={`flex min-w-0 flex-1 items-start ${isCompact ? 'gap-3' : 'gap-4'}`}>
                  <button
                    onClick={() => toggleQuestion(q)}
                    className={`shrink-0 ${isCompact || gridView === 'small' || isMobile ? 'w-9 h-9 rounded-xl' : 'w-11 h-11 rounded-2xl'} border-2 flex items-center justify-center transition-all duration-300 ${done ? 'bg-green-500 border-transparent text-white' : 'border-white/[0.12] bg-white/[0.06] text-[#94A3B8] hover:border-purple-400/50 hover:text-purple-200'}`}
                  >
                    <svg className={`${isCompact || gridView === 'small' || isMobile ? 'w-4 h-4' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <div className="min-w-0 flex-1">
                    <a
                      href={q.link}
                      target="_blank"
                      rel="noreferrer"
                      title={q.title}
                      className={`block min-w-0 overflow-hidden ${isCompact ? 'max-h-[38px] text-[13px]' : gridView === 'small' ? 'max-h-[56px] text-sm' : 'max-h-[72px] text-base'} font-bold leading-tight transition-all ${done ? 'text-[#94A3B8] line-through opacity-70 italic' : 'text-[#F8FAFC] group-hover:text-purple-300'}`}
                    >
                      {q.title}
                    </a>
                    <div className={`mt-2 flex flex-wrap items-center gap-2 ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
                      <span className="font-bold text-slate-500 font-mono tracking-normal">LC #{q.id}</span>
                      <DifficultyBadge diff={q.difficulty} />
                      {done && isCompact && <span className="hidden sm:inline font-bold text-green-400">{formatDate(timestamp)}</span>}
                    </div>
                  </div>
                </div>
                <div className={`shrink-0 flex items-center ${isCompact ? 'gap-1.5' : 'justify-between border-t border-white/[0.12] pt-2 gap-2'}`}>
                  {!isCompact && done && (
                    <div className="min-w-0 flex-1">
                      <span className="block text-[8px] font-black uppercase text-green-400/50 tracking-[0.2em]">Updated</span>
                      <span className="block truncate text-[10px] font-bold text-slate-500 font-mono italic">{formatDate(timestamp)}</span>
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      onClick={() => openOfficialSolution(q)}
                      title="View official English and Java solution"
                      className={`${isCompact || gridView === 'small' || isMobile ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'} inline-flex items-center justify-center border border-purple-500/30 bg-purple-500/10 text-purple-400 transition-all hover:border-purple-400 hover:bg-purple-500/20`}
                    >
                      <svg className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.75v10.5M8.25 9.75h7.5M5.25 4.5h13.5A1.5 1.5 0 0120.25 6v13.5l-3.75-2.25-4.5 2.25-4.5-2.25-3.75 2.25V6a1.5 1.5 0 011.5-1.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openSolutionEditor(q)}
                      title={hasSolution ? 'Edit saved solution note' : 'Add solution note'}
                      className={`${isCompact || gridView === 'small' || isMobile ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'} inline-flex items-center justify-center border transition-all ${hasSolution ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-slate-300 border-white/[0.12] bg-white/[0.06] hover:text-purple-200 hover:border-purple-500/40'}`}
                    >
                      <svg className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h6m-6 4h8M6 3h12a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 012-2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </>
  );

  const renderPatternPicker = () => (
    <div className="pb-32 space-y-9">
      <h1 className={`mx-auto max-w-[930px] text-3xl font-black tracking-normal md:text-4xl ${theme.title}`}>Syllabus</h1>
      <div className={`mx-auto max-w-[930px] rounded-2xl border p-6 md:p-8 ${theme.panel}`}>
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl md:h-24 md:w-24 ${theme.iconTile}`}>
            <div className="absolute inset-0 rounded-2xl bg-white/10" />
            <svg className="relative h-11 w-11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.75 5.75A2.75 2.75 0 017.5 3H20v14.5H7.5a2.75 2.75 0 00-2.75 2.75V5.75z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.75 20.25A2.75 2.75 0 017.5 17.5H20M8 7h8M8 10.5h6" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${theme.muted}`}>Choose Pattern</p>
            <h3 className={`mt-2 text-2xl font-black tracking-normal md:text-3xl ${theme.title}`}>Pick a syllabus pattern to start</h3>
            <p className={`mt-3 max-w-2xl text-sm font-medium leading-6 ${theme.subtle}`}>Questions stay hidden until you choose a pattern. Your last progress and notes remain linked by LeetCode ID.</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {sectionsData.map((section, sectionIndex) => {
          const stat = sectionStats.find((item) => item.id === section.id);
          const pct = stat && stat.total > 0 ? Math.round((stat.solved / stat.total) * 100) : 0;
          return (
            <section key={section.id} className={`relative overflow-hidden rounded-[20px] border p-8 ${theme.panel}`}>
              <div className={`pointer-events-none absolute inset-0 ${sectionIndex % 2 === 0 ? 'bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10' : 'bg-gradient-to-br from-purple-500/15 via-transparent to-violet-400/10'}`} />
              <div className="relative">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h4 className={`truncate text-lg font-black tracking-normal ${theme.title}`}>{section.title}</h4>
                  <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${theme.muted}`}>{stat?.solved || 0}/{stat?.total || 0} solved</p>
                </div>
                <span className="shrink-0 rounded-2xl border border-purple-500/25 bg-purple-500/10 px-3 py-1.5 text-[10px] font-black text-purple-400">{pct}%</span>
              </div>
              <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)] transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {section.patterns.map((pattern) => {
                  const doneCount = pattern.questions.filter((q) => completedMap[q.id]).length;
                  const total = pattern.questions.length;
                  const patternPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
                  const percentClass = patternPct === 100 ? 'text-green-400' : patternPct >= 70 ? 'text-purple-300' : 'text-yellow-300';
                  return (
                    <button
                      key={pattern.id}
                      onClick={() => selectPattern(section, pattern)}
                      data-section-id={section.id}
                      data-pattern-id={pattern.id}
                      className="glass-panel hover-lift h-[92px] rounded-[20px] border p-5 text-left"
                    >
                      <div className="flex h-full gap-3">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-purple-300">
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.75 3.75h7.5L19.5 9v11.25H6.75V3.75z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.25 3.75V9h5.25" />
                          </svg>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-between">
                          <span title={pattern.name} className={`line-clamp-2 text-sm font-black leading-tight ${theme.title}`}>{pattern.name}</span>
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-black uppercase tracking-widest ${theme.muted}`}>{total} Qs</span>
                          <span className={`font-mono text-[10px] font-black ${percentClass}`}>{patternPct}%</span>
                        </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );

  const renderCompanyPicker = () => (
    <div className="pb-32 space-y-6">
      <div className={`rounded-3xl border p-7 md:p-9 ${theme.panel}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${theme.muted}`}>Company Bank</p>
            <h3 className={`mt-2 text-2xl font-black tracking-normal ${theme.title}`}>Select a company first</h3>
            <p className={`mt-2 max-w-2xl text-sm font-medium leading-6 ${theme.subtle}`}>Time filters show availability, but questions open only after you enter a company.</p>
          </div>
          <div className="flex w-full flex-col gap-3 lg:w-80">
            <input
              value={companySearchTerm}
              onChange={(e) => setCompanySearchTerm(e.target.value)}
              placeholder="Search companies..."
              className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-500/30 ${theme.input}`}
            />
            <div className={`flex w-full rounded-2xl border p-1 shadow-inner ${theme.panelStrong}`}>
              {([
                ['cards', 'Cards'],
                ['list', 'List']
              ] as const).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setCompanyView(view)}
                  className={`flex-1 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${companyView === view ? theme.activeControl : `${theme.muted} hover:text-purple-400`}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2">
          {COMPANY_TIME_FILTERS.map(([bucket, label]) => {
            const count = companyBucketSections[bucket].length;
            return (
              <button
                key={bucket}
                onClick={() => setCompanyTimeFilter(bucket)}
                className={`rounded-2xl border px-4 py-3 text-left transition-all ${companyTimeFilter === bucket ? 'border-green-500/40 bg-green-500/10 text-green-400' : `${theme.panelStrong} ${theme.subtle}`}`}
              >
                <span className="block text-[10px] font-black uppercase tracking-widest">{label}</span>
                <span className="mt-1 block text-lg font-black">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {companySummaries.length === 0 ? (
        <div className={`rounded-3xl border p-10 text-center ${theme.panel}`}>
          <p className={`text-sm font-bold ${theme.subtle}`}>No companies found for this search and time range.</p>
        </div>
      ) : companyView === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companySummaries.map(({ section, bucketCounts, activeCount, allCount, activePct }) => (
              <button
                key={section.id}
                onClick={() => selectCompany(section)}
                className="glass-panel hover-lift h-[156px] rounded-[20px] border p-5 text-left"
              >
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 title={section.title} className={`truncate text-lg font-black tracking-normal ${theme.text}`}>{section.title}</h4>
                      <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${theme.muted}`}>{activeCount} in {COMPANY_TIME_FILTERS.find(([bucket]) => bucket === companyTimeFilter)?.[1]}</p>
                    </div>
                    <span className="shrink-0 rounded-xl border border-green-500/25 bg-green-500/10 px-2.5 py-1 text-[10px] font-black text-green-400">{activePct}%</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {COMPANY_TIME_FILTERS.map(([bucket, label]) => {
                      const height = allCount > 0 ? Math.max(8, Math.round((bucketCounts[bucket] / allCount) * 34)) : 8;
                      return (
                        <div key={bucket} title={`${label}: ${bucketCounts[bucket]}`} className="flex flex-col items-center gap-1">
                          <div className="flex h-9 w-full items-end rounded-lg bg-white/10 px-1">
                            <div className={`w-full rounded-md shadow-[0_0_10px_rgba(168,85,247,0.28)] ${bucket === companyTimeFilter ? 'bg-green-500' : 'bg-purple-500/70'}`} style={{ height }} />
                          </div>
                          <span className={`text-[8px] font-black uppercase ${theme.muted}`}>{bucket === 'all' ? 'All' : bucket}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </button>
            ))}
        </div>
      ) : (
        <div className="space-y-3">
          {companySummaries.map(({ section, activeCount, solvedActive, remainingActive, activePct, difficultyTotals, difficultySolved }) => (
            <button
              key={section.id}
              onClick={() => selectCompany(section)}
              className="glass-panel hover-lift w-full rounded-[20px] border p-4 text-left md:p-5"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h4 title={section.title} className={`truncate text-lg font-black tracking-normal ${theme.text}`}>{section.title}</h4>
                    <span className="rounded-xl border border-green-500/25 bg-green-500/10 px-2.5 py-1 text-[10px] font-black text-green-400">{activePct}%</span>
                  </div>
                  <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${theme.muted}`}>
                    {activeCount} questions in {COMPANY_TIME_FILTERS.find(([bucket]) => bucket === companyTimeFilter)?.[1]}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:w-[280px]">
                  {[
                    ['Done', solvedActive, 'text-green-400'],
                    ['Left', remainingActive, 'text-yellow-300'],
                    ['Total', activeCount, 'text-purple-300']
                  ].map(([label, value, color]) => (
                    <div key={label as string} className="rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 py-2">
                      <span className={`block text-[8px] font-black uppercase tracking-widest ${theme.muted}`}>{label}</span>
                      <span className={`mt-1 block font-mono text-sm font-black ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-3 lg:w-[330px]">
                  {DIFFICULTY_LEVELS.map((difficulty) => {
                    const tone = difficulty === 'Easy'
                      ? 'border-green-500/25 bg-green-500/10 text-green-300'
                      : difficulty === 'Medium'
                        ? 'border-yellow-500/25 bg-yellow-500/10 text-yellow-300'
                        : 'border-purple-500/25 bg-purple-500/10 text-purple-300';
                    return (
                      <div key={difficulty} className={`rounded-2xl border px-3 py-2 ${tone}`}>
                        <span className="block text-[8px] font-black uppercase tracking-widest">{difficulty}</span>
                        <span className="mt-1 block font-mono text-sm font-black">{difficultySolved[difficulty]}/{difficultyTotals[difficulty]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const headerTitle = isProfile
    ? (hasActiveQuestionSelection ? selectedSection?.title || 'Companies' : 'Companies')
    : isSyllabus
      ? (hasActiveQuestionSelection ? selectedPattern.name : 'Syllabus')
      : 'Objective Selection';
  const routeKey = isProfile ? 'companies' : isSyllabus ? 'syllabus' : 'roulette';
  const renderRouteContent = () => {
    if (isProfile) {
      return hasActiveQuestionSelection ? renderQuestionGrid(true) : renderCompanyPicker();
    }
    if (isSyllabus) {
      return hasActiveQuestionSelection ? renderQuestionGrid(false) : renderPatternPicker();
    }
    return (
      <div className="flex h-full flex-col items-center px-4 pt-10 md:pt-16">
        <div className="w-full max-w-2xl space-y-8 md:space-y-12">
          <div className="flex justify-center gap-2 overflow-x-auto py-2 no-scrollbar">
            {sectionStats.map(stat => (
              <button
                key={stat.id}
                onClick={() => setSelectedSectionId(stat.id)}
                className={`flex-none cursor-pointer rounded-2xl border px-4 py-2.5 transition-all active:scale-95 ${stat.id === selectedSectionId ? 'border-purple-500/40 bg-purple-500/10 shadow-xl shadow-purple-500/20' : 'glass-panel opacity-90 hover:opacity-100'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="max-w-[100px] truncate text-[9px] font-black uppercase tracking-normal text-slate-300">{stat.title}</span>
                  <span className="font-mono text-[10px] font-black text-purple-400">{Math.round((stat.solved / stat.total) * 100)}%</span>
                </div>
              </button>
            ))}
          </div>

          <div className="glass-card group relative overflow-hidden rounded-[28px] p-8 md:p-14">
            <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-violet-500 to-purple-400 opacity-90" />
            <div className="flex flex-col items-center space-y-8 text-center md:space-y-10">
              <motion.div
                animate={isPickingRandom ? { scale: [1, 1.04, 1], opacity: [0.8, 1, 0.8] } : { scale: 1, opacity: 1 }}
                transition={isPickingRandom ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
                className="flex h-16 w-16 items-center justify-center rounded-[2rem] border border-purple-500/25 bg-purple-500/10 text-purple-400 shadow-inner md:h-20 md:w-20"
              >
                <svg className="h-8 w-8 md:h-10 md:w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </motion.div>

              <div className="w-full space-y-4">
                <label className="block text-[9px] font-black uppercase tracking-[0.35em] text-[#94A3B8]">Search Scope Configuration</label>
                <div className="relative group/select">
                  <select
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                    className="glass-input w-full cursor-pointer appearance-none rounded-[1.8rem] px-8 py-4 text-sm font-bold tracking-normal text-[#F8FAFC] transition-all hover:border-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 md:py-5"
                  >
                    {sectionsData.map(s => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-[#94A3B8]">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                {currentSectionData && (
                  <div className="flex items-center justify-between px-6">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                      <span className="text-[9px] font-black uppercase tracking-normal text-[#CBD5E1]">{currentSectionData.solved}/{currentSectionData.total} Solved</span>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">{Math.round((currentSectionData.solved / currentSectionData.total) * 100)}%</span>
                  </div>
                )}
              </div>

              <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  onClick={() => pickRandom('section')}
                  disabled={isPickingRandom}
                  className="flex items-center justify-center gap-3 rounded-[1.8rem] bg-purple-500/25 px-10 py-5 text-[10px] font-black uppercase tracking-[0.25em] text-white shadow-xl shadow-purple-500/20 transition-all hover:bg-purple-400 active:scale-95 disabled:opacity-70"
                >
                  <span>{isPickingRandom ? 'Picking...' : 'Spin Section'}</span>
                  <svg className="h-4 w-4 transition-transform group-hover/spin:rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7" /></svg>
                </button>
                <button
                  onClick={() => pickRandom('global')}
                  disabled={isPickingRandom}
                  className="glass-panel flex items-center justify-center gap-3 rounded-[1.8rem] px-10 py-5 text-[10px] font-black uppercase tracking-[0.25em] text-white transition-all hover:border-purple-400/50 active:scale-95 disabled:opacity-70"
                >
                  <span>{isPickingRandom ? 'Picking...' : 'Global Spin'}</span>
                  <svg className="h-4 w-4 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`${themeMode} page-shell font-sans selection:bg-purple-500/30 ${theme.app}`}>
      <BackgroundDecorations />
      <main className="relative z-10 flex h-[100dvh] flex-col overflow-hidden">
        <AppHeader
          theme={theme}
          isBackendWaking={isBackendWaking}
          isSyllabus={isSyllabus}
          isProfile={isProfile}
          isRoulette={isRoulette}
          search={(
            <GlobalQuestionSearch
              query={questionSearchQuery}
              isOpen={isQuestionSearchOpen}
              results={questionSearchResults}
              theme={theme}
              themeMode={themeMode}
              onQueryChange={setQuestionSearchQuery}
              onOpenChange={setIsQuestionSearchOpen}
              onOpenQuestion={openSearchQuestion}
            />
          )}
          globalStats={globalStats}
          overallPercent={overallPercent}
          handle={handle}
          syncStatusConfig={SYNC_STATUS_CONFIG[syncStatus]}
          onGoSyllabus={goToSyllabusView}
          onGoCompanies={goToCompaniesView}
          onGoRoulette={goToRouletteView}
          onOpenAuth={() => {
            setAuthMode('login');
            setShowWelcome(true);
          }}
          onSyncStatusClick={handleSyncStatusClick}
        />

        <div ref={mainScrollRef} className={`mt-[var(--app-header-height)] h-[calc(100dvh-var(--app-header-height))] overflow-y-auto overflow-x-hidden p-5 sm:p-6 md:p-10 xl:p-12 custom-scrollbar ${isOldSchool ? 'old-school-content-scroll' : ''}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={routeKey}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`mx-auto min-h-full w-full max-w-[1184px] ${isOldSchool ? 'old-school-route' : ''}`}
            >
              {!(isSyllabus && !hasActiveQuestionSelection) && (
                <h1 className={`mb-7 text-3xl font-black tracking-normal md:text-4xl ${theme.title}`}>{headerTitle}</h1>
              )}
              {renderRouteContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <button
        type="button"
        onClick={toggleThemeMode}
        className={`fixed bottom-4 left-4 z-[130] inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-all hover:-translate-y-0.5 sm:bottom-5 sm:left-5 ${theme.panelStrong} ${theme.subtle} hover:text-white`}
        title={isOldSchool ? 'Switch to AI Slop UI' : 'Switch to Old School Classic'}
        aria-label={isOldSchool ? 'Switch to AI Slop UI' : 'Switch to Old School Classic'}
      >
        {isOldSchool ? <Sparkles className="h-4 w-4" /> : <Terminal className="h-4 w-4" />}
      </button>

      <QuestionSearchModal
        selectedSearchQuestion={selectedSearchQuestion}
        solutionMap={solutionMap}
        solutionNotePresenceMap={solutionNotePresenceMap}
        companyTimeFilters={COMPANY_TIME_FILTERS}
        theme={theme}
        themeMode={themeMode}
        onClose={closeSearchQuestion}
        onOpenOfficialSolution={openOfficialSolution}
        onOpenSolutionEditor={openSolutionEditor}
      />

      <OfficialSolutionModal
        question={officialSolutionQuestion}
        solution={officialSolution}
        status={officialSolutionStatus}
        view={officialSolutionView}
        themeMode={themeMode}
        onClose={closeOfficialSolution}
        onViewChange={setOfficialSolutionView}
        hasMeaningfulHint={hasMeaningfulHint}
      />

      <SolutionNoteModal
        question={editingSolutionQuestion}
        themeMode={themeMode}
        value={solutionEditorValue}
        isLoading={isLoadingSolutionNote}
        onChange={handleSolutionEditorChange}
        onClose={closeSolutionEditor}
        onSave={saveSolutionNote}
      />


      {showAddQuestionModal && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-6 bg-[#081229]/80 backdrop-blur-xl">
          <div className="glass-card w-full max-w-lg rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white tracking-normal">Add New Question</h3>
              <button onClick={() => setShowAddQuestionModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleClassifyQuestion} className="space-y-4">
              <label className="block text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-black">LeetCode Question ID</label>
              <input
                value={questionIdInput}
                onChange={(e) => setQuestionIdInput(e.target.value)}
                placeholder="e.g. 76"
                className="glass-input w-full rounded-2xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
              <button type="submit" disabled={isClassifying} className="w-full py-3 rounded-2xl bg-purple-500/25 hover:bg-purple-500/25 disabled:opacity-60 text-xs font-black uppercase tracking-[0.2em] text-white">
                {isClassifying ? 'Classifying...' : 'Get AI Suggestion'}
              </button>
            </form>

            {aiSuggestion && (
              <div className="glass-panel mt-6 rounded-2xl p-4 space-y-3">
                <p className="text-xs text-[#CBD5E1]"><span className="text-[#94A3B8]">Title:</span> {aiSuggestion.title}</p>
                <p className="text-xs text-[#CBD5E1]"><span className="text-[#94A3B8]">Difficulty:</span> {aiSuggestion.difficulty}</p>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-black mb-2">Confirm Category</label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="glass-input w-full rounded-xl px-3 py-2 text-sm text-slate-100"
                  >
                    {CATEGORY_OPTIONS.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <button onClick={handleSaveNewQuestion} disabled={isSavingQuestion} className="w-full py-3 rounded-2xl bg-green-600 hover:bg-green-500 disabled:opacity-60 text-xs font-black uppercase tracking-[0.2em] text-white">
                  {isSavingQuestion ? 'Saving...' : 'Confirm & Save'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Handle Setup Modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-[#081229]/92 backdrop-blur-3xl animate-in fade-in duration-500">
           <div className="glass-card rounded-[3.5rem] w-full max-w-md p-14 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-purple-500" />
              <div className="text-center mb-12">
                 <h3 className="text-4xl font-black text-white mb-4 tracking-normal leading-none">DSA Login</h3>
                 <p className="text-sm text-[#CBD5E1] leading-relaxed font-medium">Sign in with your username and password to sync progress across devices.</p>
              </div>
              <div className="glass-panel mb-8 grid grid-cols-3 gap-2 rounded-2xl p-1">
                {([
                  ['login', 'Login'],
                  ['signup', 'Signup'],
                  ['admin', 'Admin']
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setAuthMode(mode); setAuthError(''); }}
                    className={`rounded-xl py-2 text-[10px] font-black uppercase tracking-[0.2em] ${authMode === mode ? 'bg-purple-500/25 text-white' : 'text-[#94A3B8] hover:text-[#CBD5E1]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {authMode === 'admin' ? (
                <form onSubmit={handleAdminLogin} className="space-y-6">
                  <div className="glass-panel p-6 rounded-[2rem] transition-all focus-within:border-purple-500/70">
                    <label className="block text-[10px] font-black uppercase text-[#94A3B8] tracking-[0.3em] mb-4 text-center">Admin Key</label>
                    <input
                      autoFocus
                      type="password"
	                      placeholder="6-12 character access key"
	                      value={adminKey}
	                      onChange={(e) => setAdminKey(e.target.value)}
                      className="w-full border-none bg-transparent p-0 text-purple-200 placeholder:text-slate-500 focus:ring-0"
                    />
                  </div>
                  {authError && <p className="text-center text-xs font-bold text-purple-400">{authError}</p>}
                  <button type="submit" disabled={isAuthBusy} className="w-full py-5 bg-purple-500/25 hover:bg-purple-500/25 disabled:opacity-60 text-white rounded-[2rem] font-black text-sm tracking-[0.3em] uppercase shadow-2xl shadow-purple-600/20 transition-all active:scale-95">
                    {isAuthBusy ? 'Checking...' : 'Unlock Admin'}
                  </button>
                  {adminMessage && <p className="text-center text-xs font-bold text-yellow-300">{adminMessage}</p>}
                  {isAdminUnlocked && (
                    <div className="grid gap-3">
                      <button
                        type="button"
                        onClick={handleEnsurePerformanceIndexes}
                        disabled={isAdminBusy}
                        className="w-full rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-green-300 disabled:opacity-60"
                      >
                        {isAdminBusy ? 'Preparing...' : 'Prepare DB Indexes'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSyncDatabases}
                        disabled={isAdminBusy}
                        className="w-full rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300 disabled:opacity-60"
                      >
                        {isAdminBusy ? 'Syncing...' : 'Sync Active DB To Backup'}
                      </button>
                    </div>
                  )}
                  {adminUsers.length > 0 && (
                    <div className="glass-panel max-h-72 overflow-y-auto rounded-2xl">
                      <div className="sticky top-0 border-b border-white/[0.12] bg-[#081229]/70 p-3">
                        <input
                          value={adminSearchTerm}
                          onChange={(e) => setAdminSearchTerm(e.target.value)}
                          placeholder="Search users..."
                          className="glass-input w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                        />
                      </div>
                      {filteredAdminUsers.map((user) => (
                        <div key={user.handle} className="flex items-center justify-between gap-3 border-b border-white/[0.12] p-3 last:border-b-0">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-slate-100">@{user.handle}</div>
                            <div className="text-[10px] font-bold text-[#94A3B8]">{user.completedCount}/{user.progressCount} done {user.disabledAt ? '- disabled' : '- active'}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleAdminUser(user)}
                            disabled={isAdminBusy}
                            className={`shrink-0 rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-[0.15em] text-white disabled:opacity-60 ${user.disabledAt ? 'bg-green-600' : 'bg-purple-500/25'}`}
                          >
                            {user.disabledAt ? 'Enable' : 'Disable'}
                          </button>
                        </div>
                      ))}
                      <div className="border-t border-white/[0.12] p-3">
                        <div className="grid gap-2">
                          <input
                            value={adminResetHandle}
                            onChange={(e) => setAdminResetHandle(e.target.value)}
                            placeholder="username"
                            className="glass-input rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                          />
                          <input
                            value={adminResetPassword}
                            onChange={(e) => setAdminResetPassword(e.target.value)}
                            type="password"
                            placeholder="new password (4-10 chars)"
                            className="glass-input rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                          />
                          <button
                            type="button"
                            onClick={handleAdminResetPassword}
                            disabled={isAdminBusy}
                            className="rounded-xl bg-green-600 px-3 py-2 text-[9px] font-black uppercase tracking-[0.15em] text-white disabled:opacity-60"
                          >
                            Reset Password
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              ) : (
                <form onSubmit={setupHandle} className="space-y-6">
                  <div className="glass-panel p-6 rounded-[2rem] transition-all focus-within:border-purple-500/70">
                    <label className="block text-[10px] font-black uppercase text-[#94A3B8] tracking-[0.3em] mb-4 text-center">Username</label>
                    <div className="flex items-center gap-3 text-xl font-mono">
                      <span className="text-purple-400/40">@</span>
	                      <input autoFocus type="text" placeholder="yourname-dsa" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} className="w-full border-none bg-transparent p-0 text-purple-200 placeholder:text-slate-500 focus:ring-0" />
                    </div>
                  </div>
                  <div className="glass-panel p-6 rounded-[2rem] transition-all focus-within:border-purple-500/70">
                    <label className="block text-[10px] font-black uppercase text-[#94A3B8] tracking-[0.3em] mb-4 text-center">Password</label>
	                    <input type="password" placeholder="4-10 characters" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full border-none bg-transparent p-0 text-purple-200 placeholder:text-slate-500 focus:ring-0" />
                  </div>
                  {authError && <p className="text-center text-xs font-bold text-purple-400">{authError}</p>}
                  <button type="submit" disabled={isAuthBusy} className="w-full py-5 bg-purple-500/25 hover:bg-purple-500/25 disabled:opacity-60 text-white rounded-[2rem] font-black text-sm tracking-[0.3em] uppercase shadow-2xl shadow-purple-600/20 transition-all active:scale-95">
                    {isAuthBusy ? 'Working...' : authMode === 'signup' ? 'Create Account' : 'Login'}
                  </button>
              </form>
              )}
           </div>
        </div>
      )}

      {/* Target Focus Overlay (The Random Pick Result) */}
      <AnimatePresence>
        {randomPick && (
          <motion.div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-[#081229]/80 p-8 backdrop-blur-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="glass-card relative w-full max-w-md overflow-hidden rounded-[3rem] p-10 text-center glow-purple"
            >
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-violet-500 to-purple-400" />

              <motion.div
                initial={{ rotate: -10, scale: 0.85 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.05 }}
                className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-[1.8rem] border border-purple-500/25 bg-purple-500/15 text-purple-400"
              >
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </motion.div>

              <p className="mb-3 text-[9px] font-black uppercase tracking-[0.35em] text-slate-400">Objective Acquired</p>
              <h3 className="mb-6 text-2xl font-black leading-snug tracking-normal text-yellow-50">{randomPick.title}</h3>

              <div className="mb-10 flex items-center justify-center gap-3">
                <DifficultyBadge diff={randomPick.difficulty} />
                <span className="rounded-xl border border-white/[0.12] bg-[#081229]/80 px-3 py-1.5 font-mono text-[10px] font-black text-slate-200">LC #{randomPick.id}</span>
              </div>

              <div className="flex flex-col gap-3">
                <a
                  href={randomPick.link}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setRandomPick(null)}
                  className="rounded-[1.8rem] bg-purple-500/25 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-purple-500/20 transition-all hover:bg-purple-400 active:scale-95"
                >
                  Launch LeetCode
                </a>
                <button
                  onClick={() => setRandomPick(null)}
                  className="py-4 text-[9px] font-black uppercase tracking-widest text-slate-300 transition-colors hover:text-slate-300"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
