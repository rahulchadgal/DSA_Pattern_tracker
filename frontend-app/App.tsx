
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AdminUserRow, backendApi, CompanyQuestionRow, QuestionV2Row, subscribeBackendWakeStatus } from './lib/backendApi';
import { DSA_DATA } from './constants';
import { useProfileHandle } from './hooks/useProfileHandle';
import { useAppRoute } from './hooks/useAppRoute';
import { getOfficialSolution, OfficialSolutionEntry } from './lib/officialSolutions';
import { Pattern, Question, Section } from './types';
import { AppHeader } from './components/AppHeader';
import { GlobalQuestionSearch } from './components/GlobalQuestionSearch';
import { OfficialSolutionModal } from './components/OfficialSolutionModal';
import { QuestionSearchModal } from './components/QuestionSearchModal';
import { SolutionNoteModal } from './components/SolutionNoteModal';
import { AddQuestionModal } from './components/AddQuestionModal';
import { AuthModal } from './components/AuthModal';
import { RandomPickOverlay } from './components/RandomPickOverlay';
import { DifficultyBadge } from './components/appUi';
import type { AppThemeClasses, CompanyMention, CompanyTimeFilter, SearchQuestionResult, SyncStatus, ThemeMode } from './components/appTypes';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import { Input } from './components/ui/input';
import { Progress } from './components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './components/ui/select';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';

const LEGACY_LOCAL_CACHE_KEY = 'dsa-completed-v4-map';
const LEGACY_SOLUTION_CACHE_KEY = 'dsa-solution-notes-v1';
const PROGRESS_CACHE_PREFIX = 'dsa-progress-cache-v1';
const SOLUTION_CACHE_PREFIX = 'dsa-solution-notes-v1';
const PENDING_PROGRESS_PREFIX = 'dsa-pending-progress-v1';
const GRID_VIEW_KEY = 'dsa-grid-view-v1';
const LEGACY_CUSTOM_QUESTIONS_CACHE_KEY = 'dsa-custom-questions-v1';
const CUSTOM_QUESTIONS_CACHE_PREFIX = 'dsa-custom-questions-v1';
const ADMIN_SESSION_KEY = 'dsa-admin-session-v1';
const THEME_MODE_KEY = 'dsa-theme-mode-v1';
const DB_SYNC_COOLDOWN_MS = 60_000;
const REMOTE_PROGRESS_POLL_MS = 90_000;

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

const SYNC_STATUS_CONFIG = {
  'signed-out': { color: 'bg-slate-600', label: 'Sign in to sync' },
  idle: { color: 'bg-slate-500', label: 'Ready to sync' },
  syncing: { color: 'bg-amber-400', label: 'Sync in progress' },
  synced: { color: 'bg-emerald-500', label: 'Synced' },
  paused: { color: 'bg-orange-500', label: 'Sync unavailable' },
  error: { color: 'bg-rose-500', label: 'Sync failed' }
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
  const [gridView, setGridView] = useState<'list' | 'small' | 'big'>(() => {
    const saved = localStorage.getItem(GRID_VIEW_KEY);
    return saved === 'list' || saved === 'small' || saved === 'big' ? saved : 'list';
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => localStorage.getItem(THEME_MODE_KEY) === 'light' ? 'light' : 'dark');
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
  const customSyncPromiseRef = useRef<Promise<void> | null>(null);
  const progressSyncHandleRef = useRef('');
  const customSyncHandleRef = useRef('');
  const warmupPromiseRef = useRef<Promise<void> | null>(null);
  const loadedLocalHandleRef = useRef('');
  const activeHandleRef = useRef(normalizeHandle(handle));
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
    pendingProgressRef.current = {};
    loadedLocalHandleRef.current = '';
    progressSyncHandleRef.current = '';
    customSyncHandleRef.current = '';
    lastServerProgressMetaRef.current = null;
    setCompletedMap({});
    setSolutionMap({});
    setSolutionNotePresenceMap({});
  }, [clearHandle]);

  useEffect(() => {
    activeHandleRef.current = normalizeHandle(handle);
  }, [handle]);

  const markDbSyncUnavailable = useCallback(() => {
    lastDbSyncFailureAtRef.current = Date.now();
    setSyncStatus('paused');
  }, []);

  const warmDatabaseOnce = useCallback(() => {
    if (warmupPromiseRef.current) return warmupPromiseRef.current;
    const warmupPromise = backendApi.warmDatabase()
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        if (warmupPromiseRef.current === warmupPromise) {
          warmupPromiseRef.current = null;
        }
      });
    warmupPromiseRef.current = warmupPromise;
    return warmupPromise;
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
        cachedCompleted[leetcodeId] = cachedCompleted[leetcodeId] || pending.updatedAt;
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
            completionMap[leetcodeId] = completionMap[leetcodeId] || new Date().toISOString();
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
        lastServerProgressMetaRef.current = {
          latestUpdatedAt: rows.reduce<string | null>((latest, row) => {
            if (!row.updatedAt) return latest;
            return !latest || row.updatedAt > latest ? row.updatedAt : latest;
          }, null),
          rowCount: rows.length,
          completedCount: rows.filter(row => row.completed).length
        };

        const pendingEntries = Object.entries(pendingProgressRef.current);
        for (const [leetcodeId, pending] of pendingEntries) {
          await backendApi.upsertProgress({
            handle: normalizedHandle,
            leetcodeId,
            completed: pending.completed,
            ...(Object.prototype.hasOwnProperty.call(pending, 'solutionText') ? { solutionText: pending.solutionText ?? null } : {}),
            title: pending.metadata?.title,
            difficulty: pending.metadata?.difficulty,
            link: pending.metadata?.link,
            mainPattern: pending.metadata?.mainPattern,
            subPattern: pending.metadata?.subPattern,
            metadataJson: pending.metadata?.metadataJson ?? null
          });
          delete pendingProgressRef.current[leetcodeId];
          writeUserPendingProgressCache(normalizedHandle, pendingProgressRef.current);
        }

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
    setSyncStatus('syncing');
    try {
      const saved = await backendApi.upsertProgress({
        handle: normalizedHandle,
        leetcodeId,
        completed: isChecked,
        ...(solutionText !== undefined ? { solutionText: solutionText ?? null } : {}),
        title: metadata?.title,
        difficulty: metadata?.difficulty,
        link: metadata?.link,
        mainPattern: metadata?.mainPattern,
        subPattern: metadata?.subPattern,
        metadataJson: metadata?.metadataJson ?? null
      });
      if (saved.updatedAt) {
        const previous = lastServerProgressMetaRef.current;
        lastServerProgressMetaRef.current = {
          latestUpdatedAt: !previous?.latestUpdatedAt || saved.updatedAt > previous.latestUpdatedAt ? saved.updatedAt : previous.latestUpdatedAt,
          rowCount: previous?.rowCount || 0,
          completedCount: previous?.completedCount || 0
        };
      }
      delete pendingProgressRef.current[leetcodeId];
      writeUserPendingProgressCache(normalizedHandle, pendingProgressRef.current);
      setSyncStatus('synced');
    } catch (e) {
      if (isAuthFailure(e)) {
        clearExpiredUserSession();
        return;
      }
      lastDbSyncFailureAtRef.current = Date.now();
      setSyncStatus('error');
    }
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
    setAuthUsername('');
    setAuthPassword('');
    setSyncStatus('signed-out');
    setCompletedMap({});
    setSolutionMap({});
    setSolutionNotePresenceMap({});
    pendingProgressRef.current = {};
    loadedLocalHandleRef.current = '';
    progressSyncHandleRef.current = '';
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
          setSyncStatus('synced');
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
    if (!questionIdInput.trim()) return;
    setIsClassifying(true);
    const suggestion = await mockClassifyQuestion(questionIdInput);
    setAiSuggestion(suggestion);
    setManualCategory(suggestion.category);
    setIsClassifying(false);
  };

  const handleSaveNewQuestion = async () => {
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
    if (showWelcome) {
      warmDatabaseOnce();
    }
  }, [showWelcome, warmDatabaseOnce]);

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
      pullRelationalProgress(handle).then(() => pullCustomQuestions(handle));
      return;
    }
    loadedLocalHandleRef.current = '';
    pendingProgressRef.current = {};
    progressSyncHandleRef.current = '';
    customSyncHandleRef.current = '';
    lastServerProgressMetaRef.current = null;
    setCompletedMap({});
    setSolutionMap({});
    setSolutionNotePresenceMap({});
    setSectionsData(cloneSections(baseSectionsData));
    setSyncStatus('signed-out');
  }, [handle, loadUserLocalState, pullRelationalProgress, pullCustomQuestions, baseSectionsData]);

  useEffect(() => {
    if (!handle || !backendApi.hasAuthSession()) return;
    const normalizedHandle = normalizeHandle(handle);

    const checkRemoteProgress = async () => {
      if (document.visibilityState !== 'visible') return;
      if (progressSyncPromiseRef.current || Object.keys(pendingProgressRef.current).length > 0) return;
      if (Date.now() - lastDbSyncFailureAtRef.current < DB_SYNC_COOLDOWN_MS) return;

      try {
        const meta = await backendApi.getProgressMeta();
        if (activeHandleRef.current !== normalizedHandle) return;
        const previous = lastServerProgressMetaRef.current;
        const changed = Boolean(previous && (
          previous.latestUpdatedAt !== meta.latestUpdatedAt ||
          previous.rowCount !== meta.rowCount ||
          previous.completedCount !== meta.completedCount
        ));
        lastServerProgressMetaRef.current = meta;
        if (changed) {
          await pullRelationalProgress(normalizedHandle);
        }
      } catch (error) {
        if (isAuthFailure(error)) {
          clearExpiredUserSession();
          return;
        }
        markDbSyncUnavailable();
      }
    };

    const intervalId = window.setInterval(checkRemoteProgress, REMOTE_PROGRESS_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [handle, pullRelationalProgress, clearExpiredUserSession, markDbSyncUnavailable]);

  useEffect(() => {
    if (handle && loadedLocalHandleRef.current === normalizeHandle(handle)) {
      applyCustomRowsToSections(readUserCustomQuestionCache(handle));
    }
  }, [baseSectionsData, handle, applyCustomRowsToSections]);

  useEffect(() => {
    localStorage.setItem(GRID_VIEW_KEY, gridView);
  }, [gridView]);

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

  const toggleQuestion = (question: Question) => {
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
      setRandomPick(pool[Math.floor(Math.random() * pool.length)]);
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
        const solved = section.patterns[0]?.questions.filter((q) => completedMap[q.id]).length || 0;
        return {
          section,
          pattern: section.patterns[0] || EMPTY_PATTERN,
          bucketCounts,
          solved
        };
      });
  }, [companyBucketSections, companySearchTerm, completedMap]);

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

  const selectPattern = (section: Section, pattern: Pattern) => {
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
  };

  const backToCompanyPicker = () => {
    setSelectedSectionId('');
    setSelectedPattern(EMPTY_PATTERN);
  };

  const theme: AppThemeClasses = {
    app: themeMode === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-[#020617] text-slate-200',
    shell: themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-[#0f172a] border-slate-800/60',
    header: themeMode === 'light' ? 'bg-slate-100/85 border-slate-200' : 'bg-[#020617]/80 border-slate-800/60',
    panel: themeMode === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/40 border-slate-800/80',
    panelStrong: themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800/80',
    text: themeMode === 'light' ? 'text-slate-900' : 'text-white',
    muted: themeMode === 'light' ? 'text-slate-500' : 'text-slate-500',
    subtle: themeMode === 'light' ? 'text-slate-600' : 'text-slate-400',
    input: themeMode === 'light' ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400' : 'bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600'
  };

  const renderQuestionGrid = (showCompanyFilters: boolean) => (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={showCompanyFilters ? backToCompanyPicker : backToPatternPicker}
          className={`rounded-xl text-[10px] font-black uppercase tracking-widest ${theme.panelStrong} ${theme.subtle} hover:bg-transparent hover:text-indigo-400`}
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          Back
        </Button>
        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.muted}`}>{showCompanyFilters ? selectedSection?.title || 'Company' : selectedPattern.name || 'Pattern'}</span>
        <Tabs value={gridView} onValueChange={(value) => setGridView(value as 'list' | 'small' | 'big')}>
        <TabsList className={`h-auto rounded-2xl border p-1 shadow-inner ${theme.panelStrong}`}>
          {([
            ['list', 'Compact'],
            ['small', 'Tiles'],
            ['big', 'Focus']
          ] as const).map(([mode, label]) => (
            <TabsTrigger
              key={mode}
              value={mode}
              className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-600/20"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        </Tabs>
        {showCompanyFilters && (
          <Tabs value={companyTimeFilter} onValueChange={(value) => setCompanyTimeFilter(value as CompanyTimeFilter)}>
          <TabsList className={`h-auto rounded-2xl border p-1 shadow-inner ${theme.panelStrong}`}>
            {COMPANY_TIME_FILTERS.map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-600/20"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          </Tabs>
        )}
      </div>
      {filteredPatternQuestions.length === 0 ? (
        <Card className={`rounded-3xl text-center ${theme.panel}`}>
          <CardContent className="p-10">
          <p className={`text-sm font-bold ${theme.subtle}`}>No questions found for this selection and time range.</p>
          </CardContent>
        </Card>
      ) : (
      <div className={`pb-32 ${gridView === 'list' ? 'grid grid-cols-1 gap-2 max-w-5xl' : gridView === 'small' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'}`}>
        {filteredPatternQuestions.map(q => {
          const timestamp = completedMap[q.id];
          const done = !!timestamp;
          const hasSolution = Boolean(solutionNotePresenceMap[q.id] || (solutionMap[q.id] && solutionMap[q.id].trim().length > 0));
          const neutralCardClass = showCompanyFilters
            ? (done
              ? themeMode === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-900/65 border-slate-700/60'
              : themeMode === 'light' ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-900/45 border-slate-700/60 hover:border-slate-600')
            : (done
              ? themeMode === 'light' ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-emerald-500/[0.03] border-emerald-500/20 shadow-lg shadow-emerald-500/5'
              : themeMode === 'light' ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-600');
          const isCompact = gridView === 'list';
          return (
            <Card key={q.id} className={`group relative transition-all duration-300 ${isCompact ? 'min-h-[68px] rounded-2xl p-3' : gridView === 'small' ? 'h-[132px] p-4 rounded-2xl' : 'h-[174px] p-5 rounded-3xl sm:hover:-translate-y-0.5'} ${neutralCardClass}`}>
              <div className={`flex h-full ${isCompact ? 'items-center gap-3' : 'flex-col gap-3'}`}>
                <div className={`flex min-w-0 flex-1 items-start ${isCompact ? 'gap-3' : 'gap-4'}`}>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleQuestion(q)}
                    className={`shrink-0 ${isCompact || gridView === 'small' || isMobile ? 'h-9 w-9 rounded-xl' : 'h-11 w-11 rounded-2xl'} border-2 transition-all duration-300 ${done ? 'bg-emerald-500 border-transparent text-white hover:bg-emerald-500' : themeMode === 'light' ? 'bg-slate-50 border-slate-300 text-slate-300 hover:border-slate-500 hover:bg-slate-50' : 'bg-slate-950 border-slate-800 text-slate-800 hover:border-slate-500 hover:bg-slate-950'}`}
                  >
                    <svg className={`${isCompact || gridView === 'small' || isMobile ? 'w-4 h-4' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </Button>
                  <div className="min-w-0 flex-1">
                    <a
                      href={q.link}
                      target="_blank"
                      rel="noreferrer"
                      title={q.title}
                      className={`block min-w-0 overflow-hidden ${isCompact ? 'max-h-[38px] text-[13px]' : gridView === 'small' ? 'max-h-[56px] text-sm' : 'max-h-[72px] text-base'} font-bold leading-tight transition-all ${done ? 'text-slate-500 line-through opacity-70 italic' : themeMode === 'light' ? 'text-slate-900 group-hover:text-indigo-600' : 'text-slate-100 group-hover:text-indigo-400'}`}
                    >
                      {q.title}
                    </a>
                    <div className={`mt-2 flex flex-wrap items-center gap-2 ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
                      <span className="font-bold text-slate-500 font-mono tracking-tighter">LC #{q.id}</span>
                      <DifficultyBadge diff={q.difficulty} />
                      {done && isCompact && <span className="hidden sm:inline font-bold text-emerald-500">{formatDate(timestamp)}</span>}
                    </div>
                  </div>
                </div>
                <div className={`shrink-0 flex items-center ${isCompact ? 'gap-1.5' : 'justify-between border-t border-slate-700/20 pt-2 gap-2'}`}>
                  {!isCompact && done && (
                    <div className="min-w-0 flex-1">
                      <span className="block text-[8px] font-black uppercase text-emerald-500/50 tracking-[0.2em]">Updated</span>
                      <span className="block truncate text-[10px] font-bold text-slate-500 font-mono italic">{formatDate(timestamp)}</span>
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openOfficialSolution(q)}
                      title="View official English and Java solution"
                      className={`${isCompact || gridView === 'small' || isMobile ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'} border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:border-indigo-400 hover:bg-indigo-500/20`}
                    >
                      <svg className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.75v10.5M8.25 9.75h7.5M5.25 4.5h13.5A1.5 1.5 0 0120.25 6v13.5l-3.75-2.25-4.5 2.25-4.5-2.25-3.75 2.25V6a1.5 1.5 0 011.5-1.5z" />
                      </svg>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openSolutionEditor(q)}
                      title={hasSolution ? 'Edit saved solution note' : 'Add solution note'}
                      className={`${isCompact || gridView === 'small' || isMobile ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'} ${hasSolution ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/10' : themeMode === 'light' ? 'text-slate-500 border-slate-300 bg-slate-50 hover:text-indigo-500 hover:border-indigo-400 hover:bg-slate-50' : 'text-slate-400 border-slate-700 bg-slate-900 hover:text-indigo-300 hover:border-indigo-500/40 hover:bg-slate-900'}`}
                    >
                      <svg className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h6m-6 4h8M6 3h12a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 012-2z" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      )}
    </>
  );

  const renderPatternPicker = () => (
    <div className="pb-32 space-y-8">
      <Card className={`rounded-3xl ${theme.panel}`}>
        <CardContent className="p-6 md:p-8">
        <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${theme.muted}`}>Choose Pattern</p>
        <h3 className={`mt-2 text-2xl font-black tracking-tight ${theme.text}`}>Pick a syllabus pattern to start</h3>
        <p className={`mt-2 max-w-2xl text-sm font-medium leading-6 ${theme.subtle}`}>Questions stay hidden until you choose a pattern. Your last progress and notes remain linked by LeetCode ID.</p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {sectionsData.map((section) => {
          const stat = sectionStats.find((item) => item.id === section.id);
          const pct = stat && stat.total > 0 ? Math.round((stat.solved / stat.total) * 100) : 0;
          return (
            <Card key={section.id} className={`rounded-3xl ${theme.panel}`}>
              <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h4 className={`truncate text-lg font-black tracking-tight ${theme.text}`}>{section.title}</h4>
                  <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${theme.muted}`}>{stat?.solved || 0}/{stat?.total || 0} solved</p>
                </div>
                <Badge variant="outline" className="shrink-0 rounded-2xl border-indigo-500/25 bg-indigo-500/10 px-3 py-1.5 text-[10px] font-black text-indigo-400">{pct}%</Badge>
              </div>
              <Progress value={pct} className="mb-4 h-1.5 bg-slate-800/20 [&>div]:bg-indigo-500 [&>div]:duration-700" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {section.patterns.map((pattern) => {
                  const doneCount = pattern.questions.filter((q) => completedMap[q.id]).length;
                  const total = pattern.questions.length;
                  const patternPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
                  return (
                    <Button
                      key={pattern.id}
                      variant="outline"
                      onClick={() => selectPattern(section, pattern)}
                      className={`h-[76px] justify-start rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-transparent ${themeMode === 'light' ? 'border-slate-200 bg-slate-50 hover:border-indigo-300' : 'border-slate-800 bg-slate-950/45 hover:border-indigo-500/40'}`}
                    >
                      <div className="flex h-full w-full flex-col justify-between">
                        <span title={pattern.name} className={`line-clamp-2 text-sm font-black leading-tight ${theme.text}`}>{pattern.name}</span>
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-black uppercase tracking-widest ${theme.muted}`}>{total} Qs</span>
                          <span className="text-[10px] font-black font-mono text-indigo-400">{patternPct}%</span>
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderCompanyPicker = () => (
    <div className="pb-32 space-y-6">
      <Card className={`rounded-3xl ${theme.panel}`}>
        <CardContent className="p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${theme.muted}`}>Company Bank</p>
            <h3 className={`mt-2 text-2xl font-black tracking-tight ${theme.text}`}>Select a company first</h3>
            <p className={`mt-2 max-w-2xl text-sm font-medium leading-6 ${theme.subtle}`}>Time filters show availability, but questions open only after you enter a company.</p>
          </div>
          <div className="w-full lg:w-80">
            <Input
              value={companySearchTerm}
              onChange={(e) => setCompanySearchTerm(e.target.value)}
              placeholder="Search companies..."
              className={`h-auto rounded-2xl px-4 py-3 text-sm font-bold focus-visible:ring-emerald-500/30 ${theme.input}`}
            />
          </div>
        </div>
        <Tabs value={companyTimeFilter} onValueChange={(value) => setCompanyTimeFilter(value as CompanyTimeFilter)} className="mt-6">
        <TabsList className="grid h-auto grid-cols-2 gap-2 bg-transparent p-0 md:grid-cols-4">
          {COMPANY_TIME_FILTERS.map(([bucket, label]) => {
            const count = companyBucketSections[bucket].length;
            return (
              <TabsTrigger
                key={bucket}
                value={bucket}
                className={`h-auto rounded-2xl border px-4 py-3 text-left transition-all data-[state=active]:border-emerald-500/40 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500 ${theme.panelStrong} ${theme.subtle}`}
              >
                <span className="flex w-full flex-col items-start">
                  <span className="block text-[10px] font-black uppercase tracking-widest">{label}</span>
                  <span className="mt-1 block text-lg font-black">{count}</span>
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {companySummaries.map(({ section, bucketCounts, solved }) => {
          const activeCount = bucketCounts[companyTimeFilter];
          const allCount = bucketCounts.all;
          const pct = allCount > 0 ? Math.round((solved / allCount) * 100) : 0;
          return (
            <Button
              key={section.id}
              variant="outline"
              onClick={() => selectCompany(section)}
              className={`h-[132px] justify-start rounded-3xl p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-transparent ${themeMode === 'light' ? 'border-slate-200 bg-white hover:border-emerald-300 shadow-sm' : 'border-slate-800 bg-slate-900/45 hover:border-emerald-500/40'}`}
            >
              <div className="flex h-full w-full flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 title={section.title} className={`truncate text-lg font-black tracking-tight ${theme.text}`}>{section.title}</h4>
                    <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${theme.muted}`}>{activeCount} in {COMPANY_TIME_FILTERS.find(([bucket]) => bucket === companyTimeFilter)?.[1]}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 rounded-xl border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-500">{pct}%</Badge>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {COMPANY_TIME_FILTERS.map(([bucket, label]) => {
                    const height = allCount > 0 ? Math.max(8, Math.round((bucketCounts[bucket] / allCount) * 34)) : 8;
                    return (
                      <div key={bucket} title={`${label}: ${bucketCounts[bucket]}`} className="flex flex-col items-center gap-1">
                        <div className="flex h-9 w-full items-end rounded-lg bg-slate-500/10 px-1">
                          <div className={`w-full rounded-md ${bucket === companyTimeFilter ? 'bg-emerald-500' : 'bg-indigo-500/70'}`} style={{ height }} />
                        </div>
                        <span className={`text-[8px] font-black uppercase ${theme.muted}`}>{bucket === 'all' ? 'All' : bucket}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );

  const headerTitle = isProfile
    ? (hasActiveQuestionSelection ? selectedSection?.title || 'Companies' : 'Companies')
    : isSyllabus
      ? (hasActiveQuestionSelection ? selectedPattern.name : 'Syllabus')
      : 'Objective Selection';

  return (
    <div className={`${themeMode} min-h-screen font-sans selection:bg-indigo-500/30 ${theme.app}`}>
      <main className="flex min-h-screen flex-col overflow-hidden">
        <AppHeader
          title={headerTitle}
          theme={theme}
          themeMode={themeMode}
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
          onToggleTheme={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
        />

        <div className="flex-1 overflow-y-auto p-8 md:p-14 custom-scrollbar">
           {isProfile ? (
             hasActiveQuestionSelection ? renderQuestionGrid(true) : renderCompanyPicker()
           ) : isSyllabus ? (
             hasActiveQuestionSelection ? renderQuestionGrid(false) : renderPatternPicker()
           ) : (
             <div className="h-full flex flex-col items-center pt-10 md:pt-16 px-4">
                
                <div className="w-full max-w-2xl space-y-8 md:space-y-12">
                  {/* Category Tracker Bar */}
                  <div className="flex justify-center gap-2 overflow-x-auto no-scrollbar py-2">
                    {sectionStats.map(stat => (
                      <Button
                        key={stat.id}
                        variant="outline"
                        onClick={() => setSelectedSectionId(stat.id)}
                        className={`h-auto flex-none rounded-2xl px-4 py-2.5 transition-all active:scale-95 hover:bg-transparent ${stat.id === selectedSectionId ? 'bg-indigo-500/10 border-indigo-500/40 shadow-xl shadow-indigo-500/5' : 'bg-slate-900/40 border-slate-800/40 opacity-40 hover:opacity-100'}`}
                      >
                         <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider truncate max-w-[100px]">{stat.title}</span>
                            <span className="text-[10px] font-black font-mono text-indigo-400">{Math.round((stat.solved / stat.total) * 100)}%</span>
                         </div>
                      </Button>
                    ))}
                  </div>

                  {/* Compact Control Center */}
                  <Card className="group relative overflow-hidden rounded-[3.5rem] border-slate-800/60 bg-slate-900/40 shadow-2xl backdrop-blur-md">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 opacity-50" />
                    
                    <CardContent className="flex flex-col items-center space-y-8 p-8 text-center md:space-y-10 md:p-14">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center border border-indigo-500/20 text-indigo-400 shadow-inner group-hover:rotate-12 transition-transform">
                          <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>

                        <div className="w-full space-y-4">
                          <label className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-600 block">Search Scope Configuration</label>
                          <Select
                              value={selectedSectionId}
                              onValueChange={setSelectedSectionId}
                            >
                            <SelectTrigger className="h-auto rounded-[1.8rem] border-slate-800 bg-slate-950 px-8 py-4 text-sm font-bold tracking-tight text-slate-100 hover:border-slate-700 md:py-5">
                              <SelectValue placeholder="Select section" />
                            </SelectTrigger>
                            <SelectContent>
                              {sectionsData.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {currentSectionData && (
                            <div className="flex justify-between items-center px-6">
                               <div className="flex items-center gap-2">
                                  <div className="w-1 h-1 rounded-full bg-indigo-500" />
                                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">{currentSectionData.solved}/{currentSectionData.total} Solved</span>
                               </div>
                               <span className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">{Math.round((currentSectionData.solved/currentSectionData.total)*100)}%</span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                          <Button
                            onClick={() => pickRandom('section')}
                            className="rounded-[1.8rem] bg-indigo-600 px-10 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 active:scale-95 group/spin"
                          >
                             <span>Spin Section</span>
                             <svg className="w-4 h-4 group-hover/spin:rotate-45 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7" /></svg>
                          </Button>
                          <Button
                            onClick={() => pickRandom('global')}
                            variant="secondary"
                            className="rounded-[1.8rem] bg-slate-800 px-10 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-white hover:bg-slate-700 active:scale-95 group/spin"
                          >
                             <span>Global Spin</span>
                             <svg className="w-4 h-4 group-hover/spin:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                          </Button>
                        </div>
                    </CardContent>
                  </Card>
                </div>

             </div>
           )}
        </div>
      </main>

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


      <AddQuestionModal
        open={showAddQuestionModal}
        questionIdInput={questionIdInput}
        aiSuggestion={aiSuggestion}
        manualCategory={manualCategory}
        categoryOptions={CATEGORY_OPTIONS}
        isClassifying={isClassifying}
        isSavingQuestion={isSavingQuestion}
        onOpenChange={setShowAddQuestionModal}
        onQuestionIdChange={setQuestionIdInput}
        onManualCategoryChange={setManualCategory}
        onClassifyQuestion={handleClassifyQuestion}
        onSaveQuestion={handleSaveNewQuestion}
      />

      {/* Global Handle Setup Modal */}
      <AuthModal
        open={showWelcome}
        authMode={authMode}
        authUsername={authUsername}
        authPassword={authPassword}
        authError={authError}
        isAuthBusy={isAuthBusy}
        adminKey={adminKey}
        adminMessage={adminMessage}
        isAdminUnlocked={isAdminUnlocked}
        isAdminBusy={isAdminBusy}
        adminUsers={adminUsers}
        filteredAdminUsers={filteredAdminUsers}
        adminSearchTerm={adminSearchTerm}
        adminResetHandle={adminResetHandle}
        adminResetPassword={adminResetPassword}
        onOpenChange={setShowWelcome}
        onAuthModeChange={setAuthMode}
        onAuthErrorChange={setAuthError}
        onAuthUsernameChange={setAuthUsername}
        onAuthPasswordChange={setAuthPassword}
        onAdminKeyChange={setAdminKey}
        onAdminSearchTermChange={setAdminSearchTerm}
        onAdminResetHandleChange={setAdminResetHandle}
        onAdminResetPasswordChange={setAdminResetPassword}
        onWarmDatabase={warmDatabaseOnce}
        onAuthSubmit={setupHandle}
        onAdminLogin={handleAdminLogin}
        onEnsurePerformanceIndexes={handleEnsurePerformanceIndexes}
        onToggleAdminUser={toggleAdminUser}
        onAdminResetPasswordSubmit={handleAdminResetPassword}
      />

      {/* Target Focus Overlay (The Random Pick Result) - TRANSPARENT GLASS CARD */}
      <RandomPickOverlay randomPick={randomPick} onClose={() => setRandomPick(null)} />
    </div>
  );
};

export default App;
