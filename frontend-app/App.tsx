
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AdminUserRow, backendApi, CompanyQuestionRow, QuestionV2Row, subscribeBackendWakeStatus } from './lib/backendApi';
import { DSA_DATA } from './constants';
import { useProfileHandle } from './hooks/useProfileHandle';
import { useAppRoute } from './hooks/useAppRoute';
import { getOfficialSolution, OfficialSolutionEntry } from './lib/officialSolutions';
import { Pattern, Question, Section } from './types';

const LOCAL_CACHE_KEY = 'dsa-completed-v4-map';
const SOLUTION_CACHE_KEY = 'dsa-solution-notes-v1';
const NAVBAR_COLLAPSED_KEY = 'dsa-navbar-collapsed-v1';
const GRID_VIEW_KEY = 'dsa-grid-view-v1';
const CUSTOM_QUESTIONS_CACHE_KEY = 'dsa-custom-questions-v1';
const ADMIN_SESSION_KEY = 'dsa-admin-session-v1';
const THEME_MODE_KEY = 'dsa-theme-mode-v1';
const DB_SYNC_COOLDOWN_MS = 60_000;

type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';
type AuthMode = 'login' | 'signup' | 'admin';
type ThemeMode = 'dark' | 'light';
type SyncStatus = 'signed-out' | 'idle' | 'syncing' | 'synced' | 'paused' | 'error';

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

type CompanyTimeFilter = 'all' | '30d' | '3m' | '6m';
type CompanyBucketSections = Record<CompanyTimeFilter, Section[]>;

interface CompanyMention {
  company: string;
  buckets: CompanyTimeFilter[];
}

interface SearchQuestionResult {
  question: Question;
  sourceLabels: string[];
  companies: CompanyMention[];
}

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

const normalizeStoredMap = (raw: string | null): Record<string, string> => {
  if (!raw) return {};
  const parsed = JSON.parse(raw) as Record<string, string>;
  return Object.entries(parsed).reduce<Record<string, string>>((acc, [id, value]) => {
    acc[normalizeQuestionId(id)] = value;
    return acc;
  }, {});
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


// --- UI COMPONENTS ---

const CloudStatus: React.FC<{ status: SyncStatus }> = ({ status }) => {
  const configs = {
    'signed-out': { color: "bg-slate-600", label: "Sign in to sync" },
    idle: { color: "bg-slate-500", label: "Ready to sync" },
    syncing: { color: "bg-amber-400", label: "Sync in progress" },
    synced: { color: "bg-emerald-500", label: "Synced" },
    paused: { color: "bg-orange-500", label: "Sync unavailable" },
    error: { color: "bg-rose-500", label: "Sync failed" },
  } satisfies Record<SyncStatus, { color: string; label: string }>;
  const cfg = configs[status];
  
  return (
    <div
      title={cfg.label}
      aria-label={cfg.label}
      className="flex items-center justify-center h-8 w-8 bg-slate-900/60 rounded-full border border-slate-800/50 backdrop-blur-xl"
    >
      <div className={`w-2.5 h-2.5 rounded-full ${cfg.color} ${status === 'syncing' ? 'animate-pulse' : ''}`} />
    </div>
  );
};

const GlobalStatBadge: React.FC<{ diff: string, solved: number, total: number }> = ({ diff, solved, total }) => {
  const styles = {
    Easy: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
    Medium: "text-amber-400 border-amber-500/20 bg-amber-500/5",
    Hard: "text-rose-400 border-rose-500/20 bg-rose-500/5"
  };
  const colorClass = styles[diff as keyof typeof styles] || "text-slate-400 border-slate-800 bg-slate-900";
  
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${colorClass} transition-all duration-300`}>
      <span className="text-[10px] font-black">{diff[0]}</span>
      <div className="flex items-baseline gap-0.5">
        <span className="text-xs font-black font-mono">{solved}</span>
        <span className="text-[9px] opacity-40 font-bold">/{total}</span>
      </div>
    </div>
  );
};

const DifficultyBadge: React.FC<{ diff: string }> = ({ diff }) => {
  const styles = {
    Easy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Hard: "bg-rose-500/10 text-rose-400 border-rose-500/20"
  };
  return (
    <span className={`text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-full ${styles[diff as keyof typeof styles]}`}>
      {diff}
    </span>
  );
};

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

const WakeBanner: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;
  return (
    <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
      <span className="text-[10px] font-black uppercase tracking-[0.15em]">Waking backend... retrying automatically</span>
    </div>
  );
};

const isAuthFailure = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message === 'unauthorized' || message.includes('invalid token') || message.includes('expired token');
};

const App: React.FC = () => {
  const { handle, setHandle, showWelcome, setShowWelcome, persistHandle, clearHandle } = useProfileHandle();
  const { isProfile, isRoulette, isSyllabus, goMain, goProfile, goSyllabus, goRoulette } = useAppRoute();
  const isMobile = useIsMobile();

  // --- PROGRESS STATE (Map of ID -> Timestamp) ---
  const [completedMap, setCompletedMap] = useState<Record<string, string>>(() => {
    return normalizeStoredMap(localStorage.getItem(LOCAL_CACHE_KEY));
  });
  const [solutionMap, setSolutionMap] = useState<Record<string, string>>(() => {
    return normalizeStoredMap(localStorage.getItem(SOLUTION_CACHE_KEY));
  });
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => handle && backendApi.hasAuthSession() ? 'idle' : 'signed-out');
  const [baseSectionsData, setBaseSectionsData] = useState<Section[]>(() => getInitialSections());
  const [sectionsData, setSectionsData] = useState<Section[]>(() => getInitialSections());
  const [companyBucketSections, setCompanyBucketSections] = useState<CompanyBucketSections>(() => emptyCompanyBucketSections());
  const [selectedPattern, setSelectedPattern] = useState<Pattern>(() => EMPTY_PATTERN);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => localStorage.getItem(NAVBAR_COLLAPSED_KEY) === 'true');
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
  const solutionEditorRef = useRef<HTMLDivElement | null>(null);
  const pendingProgressRef = useRef<Record<string, { completed: boolean; solutionRichText: string | null }>>({});
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
  }, [clearHandle]);

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
    setOpenSections([]);
  }, []);

  const pullRelationalProgress = useCallback(async (userHandle: string) => {
    if (!userHandle || !backendApi.hasAuthSession()) {
      setSyncStatus('signed-out');
      return;
    }
    if (Date.now() - lastDbSyncFailureAtRef.current < DB_SYNC_COOLDOWN_MS) {
      setSyncStatus('paused');
      return;
    }
    setSyncStatus('syncing');
    try {
      const rows = await backendApi.getProgress(userHandle);
      const completionMap: Record<string, string> = {};
      const solutionNotesMap: Record<string, string> = {};
      rows.forEach((r) => {
        const leetcodeId = normalizeQuestionId(r.leetcodeId);
        if (r.completed) {
          completionMap[leetcodeId] = r.updatedAt;
        }
        if (r.solutionRichText && r.solutionRichText.trim().length > 0) {
          solutionNotesMap[leetcodeId] = r.solutionRichText;
        }
      });
      Object.entries(pendingProgressRef.current).forEach(([leetcodeId, pending]) => {
        if (pending.completed) {
          completionMap[leetcodeId] = completionMap[leetcodeId] || new Date().toISOString();
        } else {
          delete completionMap[leetcodeId];
        }
        if (pending.solutionRichText && pending.solutionRichText.trim().length > 0) {
          solutionNotesMap[leetcodeId] = pending.solutionRichText;
        } else if (pending.solutionRichText === null) {
          delete solutionNotesMap[leetcodeId];
        }
      });
      
      setCompletedMap(completionMap);
      setSolutionMap(solutionNotesMap);
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(completionMap));
      localStorage.setItem(SOLUTION_CACHE_KEY, JSON.stringify(solutionNotesMap));
      setSyncStatus('synced');
    } catch (error) {
      if (isAuthFailure(error)) {
        clearExpiredUserSession();
        return;
      }
      markDbSyncUnavailable();
    }
  }, [clearExpiredUserSession, markDbSyncUnavailable]);

  const atomicUpdate = async (
    qId: string,
    isChecked: boolean,
    solutionRichText?: string | null,
    metadata?: QuestionProgressMetadata
  ) => {
    if (!handle || !backendApi.hasAuthSession()) {
      setSyncStatus('signed-out');
      return;
    }
    const leetcodeId = normalizeQuestionId(qId);
    pendingProgressRef.current[leetcodeId] = {
      completed: isChecked,
      solutionRichText: solutionRichText ?? null
    };
    setSyncStatus('syncing');
    try {
      await backendApi.upsertProgress({
        handle: handle.toLowerCase(),
        leetcodeId,
        completed: isChecked,
        solutionRichText: solutionRichText ?? null,
        title: metadata?.title,
        difficulty: metadata?.difficulty,
        link: metadata?.link,
        mainPattern: metadata?.mainPattern,
        subPattern: metadata?.subPattern,
        metadataJson: metadata?.metadataJson ?? null
      });
      delete pendingProgressRef.current[leetcodeId];
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
      const cleanHandle = persistHandle(response.handle, response.token);
      setAuthPassword('');
      pullRelationalProgress(cleanHandle);
      pullCustomQuestions(cleanHandle);
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
    localStorage.removeItem(LOCAL_CACHE_KEY);
    localStorage.removeItem(SOLUTION_CACHE_KEY);
  };

  const pullCustomQuestions = useCallback(async (userHandle: string) => {
    const fromCache = localStorage.getItem(CUSTOM_QUESTIONS_CACHE_KEY);
    if (fromCache && baseSectionsData.length > 0) {
      const cachedRows: CustomQuestionRow[] = JSON.parse(fromCache);
      const merged = cachedRows.reduce((acc, row) => addCustomQuestionToSections(acc, row), cloneSections(baseSectionsData));
      setSectionsData(merged);
    }

    if (!userHandle || !backendApi.hasAuthSession()) {
      setSyncStatus('signed-out');
      return;
    }
    if (Date.now() - lastDbSyncFailureAtRef.current < DB_SYNC_COOLDOWN_MS) {
      setSyncStatus('paused');
      return;
    }

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

      localStorage.setItem(CUSTOM_QUESTIONS_CACHE_KEY, JSON.stringify(normalizedRows));
      if (baseSectionsData.length > 0) {
        const merged = normalizedRows.reduce((acc, row) => addCustomQuestionToSections(acc, row), cloneSections(baseSectionsData));
        setSectionsData(merged);
      }
      setSyncStatus('synced');
    } catch (error) {
      if (isAuthFailure(error)) {
        clearExpiredUserSession();
        return;
      }
      markDbSyncUnavailable();
    }
  }, [baseSectionsData, clearExpiredUserSession, markDbSyncUnavailable]);

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
      const bucketEntries = await Promise.all(COMPANY_TIME_FILTERS.map(async ([bucket]) => {
        const rows = await backendApi.getCompanyQuestions({ bucket });
        return [bucket, buildCompanySectionsFromRows(rows)] as const;
      }));
      const nextBuckets = emptyCompanyBucketSections();
      bucketEntries.forEach(([bucket, sections]) => {
        nextBuckets[bucket] = sections;
      });
      setCompanyBucketSections(nextBuckets);
    } catch {
      setCompanyBucketSections(emptyCompanyBucketSections());
    }
  }, [companyTimeFilter]);

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
    const cachedRows: CustomQuestionRow[] = JSON.parse(localStorage.getItem(CUSTOM_QUESTIONS_CACHE_KEY) || '[]');
    const deduped = [...cachedRows.filter(row => row.questionId !== newRow.questionId), newRow];
    localStorage.setItem(CUSTOM_QUESTIONS_CACHE_KEY, JSON.stringify(deduped));

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
    if (handle) {
      pullRelationalProgress(handle);
      pullCustomQuestions(handle);
      const onFocus = () => pullRelationalProgress(handle);
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
    }
    setSyncStatus('signed-out');
  }, [handle, pullRelationalProgress, pullCustomQuestions]);

  useEffect(() => {
    const cachedRows: CustomQuestionRow[] = JSON.parse(localStorage.getItem(CUSTOM_QUESTIONS_CACHE_KEY) || '[]');
    if (cachedRows.length && baseSectionsData.length > 0) {
      const merged = cachedRows.reduce((acc, row) => addCustomQuestionToSections(acc, row), cloneSections(baseSectionsData));
      setSectionsData(merged);
    }
  }, [baseSectionsData]);

  useEffect(() => {
    localStorage.setItem(NAVBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

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
    if (!editingSolutionQuestion || !solutionEditorRef.current) return;
    solutionEditorRef.current.innerHTML = solutionMap[editingSolutionQuestion.id] || '';
    solutionEditorRef.current.style.height = 'auto';
    solutionEditorRef.current.style.height = `${solutionEditorRef.current.scrollHeight}px`;
  }, [editingSolutionQuestion, solutionMap]);

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
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(nextMap));
    atomicUpdate(questionId, isNowChecked, solutionMap[questionId] ?? null, buildProgressMetadata(question));
  };

  const openSolutionEditor = (question: Question) => {
    setEditingSolutionQuestion(question);
  };

  const closeSolutionEditor = () => {
    setEditingSolutionQuestion(null);
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

  const applyEditorCommand = (command: string) => {
    document.execCommand(command, false);
    if (!solutionEditorRef.current) return;
    solutionEditorRef.current.focus();
    solutionEditorRef.current.style.height = 'auto';
    solutionEditorRef.current.style.height = `${solutionEditorRef.current.scrollHeight}px`;
  };

  const handleSolutionEditorInput = () => {
    if (!solutionEditorRef.current) return;
    solutionEditorRef.current.style.height = 'auto';
    solutionEditorRef.current.style.height = `${solutionEditorRef.current.scrollHeight}px`;
  };

  const saveSolutionNote = async () => {
    if (!editingSolutionQuestion) return;

    const questionId = normalizeQuestionId(editingSolutionQuestion.id);
    const nextHtml = solutionEditorRef.current?.innerHTML.trim() || '';
    const nextMap = { ...solutionMap };
    if (nextHtml) {
      nextMap[questionId] = nextHtml;
    } else {
      delete nextMap[questionId];
    }
    setSolutionMap(nextMap);
    localStorage.setItem(SOLUTION_CACHE_KEY, JSON.stringify(nextMap));

    if (handle) {
      await atomicUpdate(questionId, Boolean(completedMap[questionId]), nextHtml || null, buildProgressMetadata(editingSolutionQuestion));
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

  const selectPattern = (section: Section, pattern: Pattern) => {
    setSelectedSectionId(section.id);
    setSelectedPattern(pattern);
    setOpenSections(prev => prev.includes(section.id) ? prev : [...prev, section.id]);
    setIsSidebarOpen(false);
    goSyllabus();
  };

  const selectCompany = (section: Section) => {
    const pattern = section.patterns[0] || EMPTY_PATTERN;
    setSelectedSectionId(section.id);
    setSelectedPattern(pattern);
    setOpenSections([section.id]);
    setIsSidebarOpen(false);
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

  const theme = {
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

  const renderGlobalQuestionSearch = () => {
    const query = questionSearchQuery.trim();
    const showResults = isQuestionSearchOpen && query.length > 0;

    return (
      <div className="relative w-full max-w-2xl xl:flex-1">
        <div className={`flex h-12 items-center gap-3 rounded-2xl border px-4 shadow-inner transition-all focus-within:ring-2 focus-within:ring-indigo-500/30 ${theme.input}`}>
          <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
          </svg>
          <input
            value={questionSearchQuery}
            onChange={(e) => {
              setQuestionSearchQuery(e.target.value);
              setIsQuestionSearchOpen(true);
            }}
            onFocus={() => setIsQuestionSearchOpen(true)}
            placeholder="Search LC ID or question name..."
            className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-slate-500"
          />
          {questionSearchQuery && (
            <button
              type="button"
              onClick={() => {
                setQuestionSearchQuery('');
                setIsQuestionSearchOpen(false);
              }}
              className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-400"
              title="Clear question search"
            >
              Clear
            </button>
          )}
        </div>

        {showResults && (
          <div className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[80] max-h-[420px] overflow-y-auto rounded-2xl border p-2 shadow-2xl ${themeMode === 'light' ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950'}`}>
            {questionSearchResults.length === 0 ? (
              <div className={`p-4 text-sm font-bold ${theme.subtle}`}>No matching questions found.</div>
            ) : (
              questionSearchResults.map((result) => {
                const companyCount = result.companies.length;
                const sourcePreview = result.sourceLabels.slice(0, 2).join(' • ');
                return (
                  <button
                    key={result.question.id}
                    type="button"
                    onClick={() => openSearchQuestion(result)}
                    className={`w-full rounded-xl p-3 text-left transition-all ${themeMode === 'light' ? 'hover:bg-slate-100' : 'hover:bg-slate-900'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-black ${theme.text}`}>{result.question.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] font-black text-slate-500">LC #{result.question.id}</span>
                          <DifficultyBadge diff={result.question.difficulty} />
                        </div>
                      </div>
                      {companyCount > 0 && (
                        <span className="shrink-0 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-500">
                          {companyCount} co
                        </span>
                      )}
                    </div>
                    <p className={`mt-2 truncate text-[10px] font-bold ${theme.muted}`}>
                      {companyCount > 0 ? `Asked by ${result.companies.slice(0, 3).map((item) => item.company).join(', ')}` : sourcePreview}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  const renderQuestionGrid = (showCompanyFilters: boolean) => (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button
          onClick={showCompanyFilters ? backToCompanyPicker : backToPatternPicker}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${theme.panelStrong} ${theme.subtle} hover:text-indigo-400`}
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
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${gridView === mode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : `${theme.muted} hover:text-indigo-400`}`}
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
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${companyTimeFilter === value ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : `${theme.muted} hover:text-emerald-500`}`}
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
          const hasSolution = Boolean(solutionMap[q.id] && solutionMap[q.id].trim().length > 0);
          const neutralCardClass = showCompanyFilters
            ? (done
              ? themeMode === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-900/65 border-slate-700/60'
              : themeMode === 'light' ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-900/45 border-slate-700/60 hover:border-slate-600')
            : (done
              ? themeMode === 'light' ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-emerald-500/[0.03] border-emerald-500/20 shadow-lg shadow-emerald-500/5'
              : themeMode === 'light' ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-600');
          const isCompact = gridView === 'list';
          return (
            <div key={q.id} className={`group relative border transition-all duration-300 ${isCompact ? 'min-h-[68px] rounded-2xl p-3' : gridView === 'small' ? 'h-[132px] p-4 rounded-2xl' : 'h-[174px] p-5 rounded-3xl sm:hover:-translate-y-0.5'} ${neutralCardClass}`}>
              <div className={`flex h-full ${isCompact ? 'items-center gap-3' : 'flex-col gap-3'}`}>
                <div className={`flex min-w-0 flex-1 items-start ${isCompact ? 'gap-3' : 'gap-4'}`}>
                  <button
                    onClick={() => toggleQuestion(q)}
                    className={`shrink-0 ${isCompact || gridView === 'small' || isMobile ? 'w-9 h-9 rounded-xl' : 'w-11 h-11 rounded-2xl'} border-2 flex items-center justify-center transition-all duration-300 ${done ? 'bg-emerald-500 border-transparent text-white' : themeMode === 'light' ? 'bg-slate-50 border-slate-300 text-slate-300 hover:border-slate-500' : 'bg-slate-950 border-slate-800 text-slate-800 hover:border-slate-500'}`}
                  >
                    <svg className={`${isCompact || gridView === 'small' || isMobile ? 'w-4 h-4' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </button>
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
                    <button
                      onClick={() => openOfficialSolution(q)}
                      title="View official English and Java solution"
                      className={`${isCompact || gridView === 'small' || isMobile ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'} inline-flex items-center justify-center border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 transition-all hover:border-indigo-400 hover:bg-indigo-500/20`}
                    >
                      <svg className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.75v10.5M8.25 9.75h7.5M5.25 4.5h13.5A1.5 1.5 0 0120.25 6v13.5l-3.75-2.25-4.5 2.25-4.5-2.25-3.75 2.25V6a1.5 1.5 0 011.5-1.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openSolutionEditor(q)}
                      title={hasSolution ? 'Edit saved solution note' : 'Add solution note'}
                      className={`${isCompact || gridView === 'small' || isMobile ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'} inline-flex items-center justify-center border transition-all ${hasSolution ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' : themeMode === 'light' ? 'text-slate-500 border-slate-300 bg-slate-50 hover:text-indigo-500 hover:border-indigo-400' : 'text-slate-400 border-slate-700 bg-slate-900 hover:text-indigo-300 hover:border-indigo-500/40'}`}
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
    <div className="pb-32 space-y-8">
      <div className={`rounded-3xl border p-6 md:p-8 ${theme.panel}`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${theme.muted}`}>Choose Pattern</p>
        <h3 className={`mt-2 text-2xl font-black tracking-tight ${theme.text}`}>Pick a syllabus pattern to start</h3>
        <p className={`mt-2 max-w-2xl text-sm font-medium leading-6 ${theme.subtle}`}>Questions stay hidden until you choose a pattern. Your last progress and notes remain linked by LeetCode ID.</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {sectionsData.map((section) => {
          const stat = sectionStats.find((item) => item.id === section.id);
          const pct = stat && stat.total > 0 ? Math.round((stat.solved / stat.total) * 100) : 0;
          return (
            <section key={section.id} className={`rounded-3xl border p-5 ${theme.panel}`}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h4 className={`truncate text-lg font-black tracking-tight ${theme.text}`}>{section.title}</h4>
                  <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${theme.muted}`}>{stat?.solved || 0}/{stat?.total || 0} solved</p>
                </div>
                <span className="shrink-0 rounded-2xl border border-indigo-500/25 bg-indigo-500/10 px-3 py-1.5 text-[10px] font-black text-indigo-400">{pct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-800/20 overflow-hidden mb-4">
                <div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {section.patterns.map((pattern) => {
                  const doneCount = pattern.questions.filter((q) => completedMap[q.id]).length;
                  const total = pattern.questions.length;
                  const patternPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
                  return (
                    <button
                      key={pattern.id}
                      onClick={() => selectPattern(section, pattern)}
                      className={`h-[76px] rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 ${themeMode === 'light' ? 'border-slate-200 bg-slate-50 hover:border-indigo-300' : 'border-slate-800 bg-slate-950/45 hover:border-indigo-500/40'}`}
                    >
                      <div className="flex h-full flex-col justify-between">
                        <span title={pattern.name} className={`line-clamp-2 text-sm font-black leading-tight ${theme.text}`}>{pattern.name}</span>
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-black uppercase tracking-widest ${theme.muted}`}>{total} Qs</span>
                          <span className="text-[10px] font-black font-mono text-indigo-400">{patternPct}%</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );

  const renderCompanyPicker = () => (
    <div className="pb-32 space-y-6">
      <div className={`rounded-3xl border p-6 md:p-8 ${theme.panel}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${theme.muted}`}>Company Bank</p>
            <h3 className={`mt-2 text-2xl font-black tracking-tight ${theme.text}`}>Select a company first</h3>
            <p className={`mt-2 max-w-2xl text-sm font-medium leading-6 ${theme.subtle}`}>Time filters show availability, but questions open only after you enter a company.</p>
          </div>
          <div className="w-full lg:w-80">
            <input
              value={companySearchTerm}
              onChange={(e) => setCompanySearchTerm(e.target.value)}
              placeholder="Search companies..."
              className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${theme.input}`}
            />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2">
          {COMPANY_TIME_FILTERS.map(([bucket, label]) => {
            const count = companyBucketSections[bucket].length;
            return (
              <button
                key={bucket}
                onClick={() => setCompanyTimeFilter(bucket)}
                className={`rounded-2xl border px-4 py-3 text-left transition-all ${companyTimeFilter === bucket ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500' : `${theme.panelStrong} ${theme.subtle}`}`}
              >
                <span className="block text-[10px] font-black uppercase tracking-widest">{label}</span>
                <span className="mt-1 block text-lg font-black">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {companySummaries.map(({ section, bucketCounts, solved }) => {
          const activeCount = bucketCounts[companyTimeFilter];
          const allCount = bucketCounts.all;
          const pct = allCount > 0 ? Math.round((solved / allCount) * 100) : 0;
          return (
            <button
              key={section.id}
              onClick={() => selectCompany(section)}
              className={`h-[132px] rounded-3xl border p-4 text-left transition-all hover:-translate-y-0.5 ${themeMode === 'light' ? 'border-slate-200 bg-white hover:border-emerald-300 shadow-sm' : 'border-slate-800 bg-slate-900/45 hover:border-emerald-500/40'}`}
            >
              <div className="flex h-full flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 title={section.title} className={`truncate text-lg font-black tracking-tight ${theme.text}`}>{section.title}</h4>
                    <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${theme.muted}`}>{activeCount} in {COMPANY_TIME_FILTERS.find(([bucket]) => bucket === companyTimeFilter)?.[1]}</p>
                  </div>
                  <span className="shrink-0 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-500">{pct}%</span>
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
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col md:flex-row min-h-screen font-sans selection:bg-indigo-500/30 ${theme.app}`}>
      
      {/* Sidebar Navigation */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen border-r flex flex-col z-50 ${theme.shell}
        transition-all duration-500 md:translate-x-0 ${isSidebarCollapsed ? 'md:w-24' : 'md:w-80'} w-80
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className={`${isSidebarCollapsed ? 'p-4' : 'p-8'} border-b ${themeMode === 'light' ? 'border-slate-200' : 'border-slate-800/40'}`}>
          <div className="flex items-center justify-between gap-2">
            {!isSidebarCollapsed && <h1 className={`text-2xl font-black tracking-tighter mb-2 underline decoration-indigo-500 underline-offset-8 ${theme.text}`}>DSA ENGINE</h1>}
            {isSidebarCollapsed && <h1 className={`text-lg font-black tracking-tighter ${theme.text}`}>DSA</h1>}
            <button
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              className={`hidden md:flex p-2 rounded-xl border ${theme.panelStrong} ${theme.subtle} hover:text-indigo-400`}
              title={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              <svg className={`w-4 h-4 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <button onClick={() => setShowWelcome(true)} className="flex items-center gap-2 group w-fit text-left">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {!isSidebarCollapsed && <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${theme.muted} group-hover:text-indigo-400`}>@{handle || 'guest'}</span>}
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
          {isProfile && (
            <div className="mb-3">
              <input
                value={companySearchTerm}
                onChange={(e) => setCompanySearchTerm(e.target.value)}
                placeholder="Search companies..."
                className={`w-full rounded-xl border px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${theme.input}`}
              />
            </div>
          )}
          {displayedSections.map(section => (
            <div key={section.id} className="space-y-1">
              <button
                title={section.title}
                onClick={() => setOpenSections(prev => prev.includes(section.id) ? prev.filter(i => i !== section.id) : [...prev, section.id])}
                className={`w-full flex items-center justify-between p-3 text-left group ${isSidebarCollapsed ? 'px-1' : ''}`}
              >
                <span className={`text-[10px] font-black uppercase tracking-widest ${openSections.includes(section.id) ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400'} ${isSidebarCollapsed ? 'mx-auto text-center' : ''}`}>{isSidebarCollapsed ? section.title.slice(0, 3) : section.title}</span>
                {!isSidebarCollapsed && <svg className={`w-3 h-3 text-slate-700 transition-transform ${openSections.includes(section.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
              </button>
              
              {openSections.includes(section.id) && !isSidebarCollapsed && (
                <div className="space-y-1 ml-2">
                  {section.patterns.map(pattern => {
                    const active = selectedSectionId === section.id && selectedPattern.id === pattern.id;
                    const doneCount = pattern.questions.filter(q => completedMap[q.id]).length;
                    const total = pattern.questions.length;
                    const pct = Math.round((doneCount/total)*100);
                    return (
                      <button 
                        key={pattern.id} 
                        onClick={() => {
                          if (isProfile) {
                            selectCompany(section);
                          } else {
                            selectPattern(section, pattern);
                          }
                        }}
                        className={`w-full group px-4 py-3 rounded-2xl text-[12px] text-left transition-all border ${active ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-lg shadow-indigo-500/5' : `${theme.muted} ${themeMode === 'light' ? 'hover:bg-slate-100' : 'hover:bg-slate-800/40'} border-transparent`}`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="truncate font-bold tracking-tight pr-4">{isProfile ? section.title : pattern.name}</span>
                          <span className={`text-[9px] font-black font-mono ${pct === 100 ? 'text-emerald-500' : 'opacity-60'}`}>{pct}%</span>
                        </div>
                        <div className="h-1 w-full bg-slate-800/50 rounded-full overflow-hidden">
                           <div className={`h-full transition-all duration-700 ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className={`${isSidebarCollapsed ? 'p-4' : 'p-8'} border-t ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-slate-800/40'}`}>
           <div className="flex justify-between items-end mb-3">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Overall Progress</span>
              <span className={`text-xl font-black ${theme.text}`}>{overallPercent}%</span>
           </div>
           <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-1000" style={{ width: `${overallPercent}%` }} />
           </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className={`px-8 py-6 md:px-14 md:py-8 border-b backdrop-blur-2xl z-20 sticky top-0 ${theme.header}`}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-6">
              <button onClick={() => setIsSidebarOpen(true)} className={`md:hidden p-3 rounded-2xl border ${theme.panelStrong} ${theme.subtle}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <button onClick={() => setIsSidebarCollapsed(prev => !prev)} className={`hidden md:flex p-3 rounded-2xl border ${theme.panelStrong} ${theme.subtle}`}>
                <svg className={`w-5 h-5 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h2 className={`text-xl md:text-2xl font-black tracking-tighter ${theme.text}`}>
                  {isProfile ? (hasActiveQuestionSelection ? selectedSection?.title || 'Companies' : 'Companies') : isSyllabus ? (hasActiveQuestionSelection ? selectedPattern.name : 'Syllabus') : 'Objective Selection'}
                </h2>
                <div className="flex items-center gap-3 mt-1.5">
                   <CloudStatus status={syncStatus} />
                   <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-900/60 rounded-xl border border-slate-800/50">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Global</span>
                      <span className="text-[10px] font-black text-indigo-400 font-mono">{overallPercent}%</span>
                   </div>
                </div>
                <WakeBanner visible={isBackendWaking} />
              </div>
            </div>

            {renderGlobalQuestionSearch()}
            
            <div className="flex flex-wrap items-center gap-4 xl:justify-end">
               <div className="hidden lg:flex gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/50">
                  {(Object.entries(globalStats) as [string, { total: number; solved: number }][]).map(([diff, data]) => (
                    <GlobalStatBadge key={diff} diff={diff} solved={data.solved} total={data.total} />
                  ))}
               </div>
               <button
                 onClick={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
                 className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all ${theme.panelStrong} ${theme.subtle} hover:text-indigo-400`}
                 title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
               >
                 {themeMode === 'dark' ? (
                   <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36 6.36l-1.42-1.42M7.06 7.06 5.64 5.64m12.72 0-1.42 1.42M7.06 16.94l-1.42 1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" /></svg>
                 ) : (
                   <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z" /></svg>
                 )}
               </button>

               {/* Header Mode Switcher */}
               <div className={`flex p-1 rounded-2xl border shadow-inner ${theme.panelStrong}`}>
                  <button
                    onClick={goMain}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isProfile ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : `${theme.muted} hover:text-indigo-400`}`}
                  >
                    Main
                  </button>
                  <button
                    onClick={goProfile}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isProfile ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : `${theme.muted} hover:text-indigo-400`}`}
                  >
                    Companies
                  </button>
               </div>
               {!isProfile && (
                 <div className={`hidden sm:flex p-1 rounded-2xl border shadow-inner ${theme.panelStrong}`}>
                    <button 
                      onClick={goSyllabus}
                      className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isSyllabus ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : `${theme.muted} hover:text-indigo-400`}`}
                    >
                      Syllabus
                    </button>
                    <button 
                      onClick={goRoulette}
                      className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isRoulette ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : `${theme.muted} hover:text-indigo-400`}`}
                    >
                      Roulette
                    </button>
                 </div>
               )}
            </div>
          </div>
        </header>

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
                      <button 
                        key={stat.id}
                        onClick={() => setSelectedSectionId(stat.id)}
                        className={`flex-none cursor-pointer px-4 py-2.5 rounded-2xl border transition-all active:scale-95 ${stat.id === selectedSectionId ? 'bg-indigo-500/10 border-indigo-500/40 shadow-xl shadow-indigo-500/5' : 'bg-slate-900/40 border-slate-800/40 opacity-40 hover:opacity-100'}`}
                      >
                         <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider truncate max-w-[100px]">{stat.title}</span>
                            <span className="text-[10px] font-black font-mono text-indigo-400">{Math.round((stat.solved / stat.total) * 100)}%</span>
                         </div>
                      </button>
                    ))}
                  </div>

                  {/* Compact Control Center */}
                  <div className="group relative p-8 md:p-14 rounded-[3.5rem] bg-slate-900/40 border border-slate-800/60 shadow-2xl overflow-hidden backdrop-blur-md">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 opacity-50" />
                    
                    <div className="flex flex-col items-center text-center space-y-8 md:space-y-10">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center border border-indigo-500/20 text-indigo-400 shadow-inner group-hover:rotate-12 transition-transform">
                          <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>

                        <div className="w-full space-y-4">
                          <label className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-600 block">Search Scope Configuration</label>
                          <div className="relative group/select">
                            <select 
                              value={selectedSectionId}
                              onChange={(e) => setSelectedSectionId(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-slate-100 py-4 md:py-5 px-8 rounded-[1.8rem] appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all cursor-pointer font-bold text-sm tracking-tight hover:border-slate-700"
                            >
                                {sectionsData.map(s => (
                                  <option key={s.id} value={s.id}>{s.title}</option>
                                ))}
                            </select>
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                          </div>
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
                          <button 
                            onClick={() => pickRandom('section')}
                            className="py-5 px-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-3 group/spin"
                          >
                             <span>Spin Section</span>
                             <svg className="w-4 h-4 group-hover/spin:rotate-45 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7" /></svg>
                          </button>
                          <button 
                            onClick={() => pickRandom('global')}
                            className="py-5 px-10 bg-slate-800 hover:bg-slate-700 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-[0.3em] transition-all active:scale-95 flex items-center justify-center gap-3 group/spin"
                          >
                             <span>Global Spin</span>
                             <svg className="w-4 h-4 group-hover/spin:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                          </button>
                        </div>
                    </div>
                  </div>
                </div>

             </div>
           )}
        </div>
      </main>

      {selectedSearchQuestion && (
        <div className="fixed inset-0 z-[105] overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-xl md:p-6">
          <div className={`mx-auto my-4 w-full max-w-4xl rounded-[2rem] border p-6 shadow-2xl md:my-8 md:p-8 ${themeMode === 'light' ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#0f172a]'}`}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${theme.muted}`}>Question Lookup</p>
                <h3 className={`mt-2 text-2xl font-black tracking-tight ${theme.text}`}>{selectedSearchQuestion.question.title}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-black text-slate-500">LC #{selectedSearchQuestion.question.id}</span>
                  <DifficultyBadge diff={selectedSearchQuestion.question.difficulty} />
                </div>
              </div>
              <button
                onClick={closeSearchQuestion}
                className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-black ${theme.panelStrong} ${theme.subtle} hover:text-indigo-400`}
                title="Close question lookup"
              >
                X
              </button>
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              <a
                href={selectedSearchQuestion.question.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/20"
              >
                Open LeetCode
              </a>
              <button
                type="button"
                onClick={() => openOfficialSolution(selectedSearchQuestion.question)}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/20"
              >
                Official Solution
              </button>
              <button
                type="button"
                onClick={() => openSolutionEditor(selectedSearchQuestion.question)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest ${solutionMap[selectedSearchQuestion.question.id] ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : themeMode === 'light' ? 'border-slate-300 bg-slate-50 text-slate-500 hover:text-indigo-500' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-indigo-300'}`}
              >
                {solutionMap[selectedSearchQuestion.question.id] ? 'Edit Note' : 'Add Note'}
              </button>
            </div>

            <div className={`rounded-2xl border p-5 ${theme.panelStrong}`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h4 className={`text-sm font-black uppercase tracking-[0.2em] ${theme.text}`}>Asked By Companies</h4>
                <span className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-500">
                  {selectedSearchQuestion.companies.length}
                </span>
              </div>

              {selectedSearchQuestion.companies.length === 0 ? (
                <div className={`rounded-xl border border-dashed p-5 text-sm font-bold ${themeMode === 'light' ? 'border-slate-300 text-slate-500' : 'border-slate-700 text-slate-400'}`}>
                  No company mentions are available for this question in the current company bank.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {selectedSearchQuestion.companies.map((mention) => (
                    <div key={mention.company} className={`rounded-xl border p-3 ${themeMode === 'light' ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/70'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <p className={`min-w-0 truncate text-sm font-black ${theme.text}`} title={mention.company}>{mention.company}</p>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          {mention.buckets.map((bucket) => (
                            <span key={bucket} className={`rounded-lg px-2 py-0.5 text-[9px] font-black uppercase ${bucket === 'all' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-500'}`}>
                              {COMPANY_TIME_FILTERS.find(([value]) => value === bucket)?.[1] || bucket}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {officialSolutionQuestion && (
        <div className="fixed inset-0 z-[106] overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-xl md:p-6">
          <div className="mx-auto my-4 flex min-h-[calc(100vh-2rem)] w-full max-w-[min(96vw,1400px)] flex-col rounded-[2.5rem] border border-slate-800 bg-[#0f172a] p-6 md:my-6 md:min-h-[calc(100vh-3rem)] md:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black tracking-tight text-white">Official Solution</h3>
                <p className="mt-1 text-xs text-slate-400">
                  LC #{officialSolutionQuestion.id} • {officialSolutionQuestion.title}
                </p>
              </div>
              <button onClick={closeOfficialSolution} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {officialSolutionStatus === 'loading' && (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 p-8 text-sm font-bold text-slate-400">
                Loading official solution...
              </div>
            )}

            {officialSolutionStatus === 'missing' && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-sm text-amber-100">
                Official solution data is not available for this question yet.
              </div>
            )}

            {officialSolutionStatus === 'error' && (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-100">
                Unable to load official solution data.
              </div>
            )}

            {officialSolutionStatus === 'ready' && officialSolution && (
              <div className="flex flex-1 flex-col gap-5 overflow-hidden">
                <div className="flex flex-wrap items-center gap-2">
                  <DifficultyBadge diff={officialSolution.difficulty} />
                  {officialSolution.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-2">
                  <button
                    type="button"
                    onClick={() => setOfficialSolutionView('question')}
                    className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${officialSolutionView === 'question' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Question
                  </button>
                  {hasMeaningfulHint(officialSolution) && (
                    <button
                      type="button"
                      onClick={() => setOfficialSolutionView('hint')}
                      className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${officialSolutionView === 'hint' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Show Hint
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOfficialSolutionView('solution')}
                    className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${officialSolutionView === 'solution' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Show Solution
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-5">
                  {officialSolutionView === 'question' && (
                    <>
                      <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Question</h4>
                      <div
                        className="prose prose-invert max-w-none text-sm leading-7 text-slate-200 prose-p:text-slate-300 prose-li:text-slate-300 prose-pre:border prose-pre:border-slate-800 prose-pre:bg-slate-900"
                        dangerouslySetInnerHTML={{ __html: officialSolution.descriptionHtml }}
                      />
                    </>
                  )}

                  {officialSolutionView === 'hint' && (
                    <>
                      <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Hint / Approach</h4>
                      <pre className="whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm leading-7 text-slate-200">
                        {officialSolution.solutionMarkdown}
                      </pre>
                    </>
                  )}

                  {officialSolutionView === 'solution' && (
                    <>
                      <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Java Solution</h4>
                      {officialSolution.hasJava ? (
                        <pre className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#020617] p-4 text-[12px] leading-6 text-slate-100">
                          <code>{officialSolution.java}</code>
                        </pre>
                      ) : (
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-100">
                          Java solution is unavailable for this problem in the source repo.
                        </div>
                      )}
                      <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                        Source: {officialSolution.sourcePath}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {editingSolutionQuestion && (
        <div className="fixed inset-0 z-[106] overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-xl md:p-6">
          <div className="mx-auto my-4 flex min-h-[calc(100vh-2rem)] w-full max-w-[min(96vw,1400px)] flex-col rounded-[2.5rem] border border-slate-800 bg-[#0f172a] p-6 md:my-6 md:min-h-[calc(100vh-3rem)] md:p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Solution Notes</h3>
                <p className="text-xs text-slate-400 mt-1">
                  LC #{editingSolutionQuestion.id} • {editingSolutionQuestion.title}
                </p>
              </div>
              <button onClick={closeSolutionEditor} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <button
                onClick={() => applyEditorCommand('bold')}
                type="button"
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-black text-slate-200"
              >
                Bold
              </button>
              <button
                onClick={() => applyEditorCommand('italic')}
                type="button"
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-black text-slate-200"
              >
                Italic
              </button>
              <button
                onClick={() => applyEditorCommand('insertUnorderedList')}
                type="button"
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-black text-slate-200"
              >
                Bullet
              </button>
            </div>

            <div
              ref={solutionEditorRef}
              contentEditable
              onInput={handleSolutionEditorInput}
              suppressContentEditableWarning
              className="min-h-[55vh] w-full flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 overflow-hidden"
            />

            <div className="mt-5 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Your note is stored per handle and question.</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={closeSolutionEditor}
                  className="px-5 py-2.5 rounded-2xl border border-slate-700 text-xs font-black uppercase tracking-[0.15em] text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSolutionNote}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black uppercase tracking-[0.15em] text-white"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {showAddQuestionModal && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl">
          <div className="w-full max-w-lg rounded-[2.5rem] border border-slate-800 bg-[#0f172a] p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white tracking-tight">Add New Question</h3>
              <button onClick={() => setShowAddQuestionModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleClassifyQuestion} className="space-y-4">
              <label className="block text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">LeetCode Question ID</label>
              <input
                value={questionIdInput}
                onChange={(e) => setQuestionIdInput(e.target.value)}
                placeholder="e.g. 76"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button type="submit" disabled={isClassifying} className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-xs font-black uppercase tracking-[0.2em] text-white">
                {isClassifying ? 'Classifying...' : 'Get AI Suggestion'}
              </button>
            </form>

            {aiSuggestion && (
              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <p className="text-xs text-slate-300"><span className="text-slate-500">Title:</span> {aiSuggestion.title}</p>
                <p className="text-xs text-slate-300"><span className="text-slate-500">Difficulty:</span> {aiSuggestion.difficulty}</p>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black mb-2">Confirm Category</label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  >
                    {CATEGORY_OPTIONS.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <button onClick={handleSaveNewQuestion} disabled={isSavingQuestion} className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-xs font-black uppercase tracking-[0.2em] text-white">
                  {isSavingQuestion ? 'Saving...' : 'Confirm & Save'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Handle Setup Modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-slate-950/98 backdrop-blur-3xl animate-in fade-in duration-500">
           <div className="bg-[#0f172a] border border-slate-800/80 rounded-[3.5rem] w-full max-w-md p-14 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-indigo-500" />
              <div className="text-center mb-12">
                 <h3 className="text-4xl font-black text-white mb-4 tracking-tighter leading-none">DSA Login</h3>
                 <p className="text-sm text-slate-500 leading-relaxed font-medium">Sign in with your username and password to sync progress across devices.</p>
              </div>
              <div className="mb-8 grid grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-1">
                {([
                  ['login', 'Login'],
                  ['signup', 'Signup'],
                  ['admin', 'Admin']
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setAuthMode(mode); setAuthError(''); }}
                    className={`rounded-xl py-2 text-[10px] font-black uppercase tracking-[0.2em] ${authMode === mode ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {authMode === 'admin' ? (
                <form onSubmit={handleAdminLogin} className="space-y-6">
                  <div className="bg-slate-950 p-6 rounded-[2rem] border border-slate-800 transition-all focus-within:border-emerald-500/50">
                    <label className="block text-[10px] font-black uppercase text-slate-600 tracking-[0.3em] mb-4 text-center">Admin Key</label>
                    <input
                      autoFocus
                      type="password"
                      placeholder="6-12 character access key"
                      value={adminKey}
                      onChange={(e) => setAdminKey(e.target.value)}
                      className="w-full bg-transparent border-none text-emerald-400 focus:ring-0 p-0 placeholder:text-slate-800"
                    />
                  </div>
                  {authError && <p className="text-center text-xs font-bold text-rose-400">{authError}</p>}
                  <button type="submit" disabled={isAuthBusy} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-[2rem] font-black text-sm tracking-[0.3em] uppercase shadow-2xl shadow-indigo-600/20 transition-all active:scale-95">
                    {isAuthBusy ? 'Checking...' : 'Unlock Admin'}
                  </button>
                  {adminMessage && <p className="text-center text-xs font-bold text-amber-300">{adminMessage}</p>}
                  {isAdminUnlocked && (
                    <button
                      type="button"
                      onClick={handleEnsurePerformanceIndexes}
                      disabled={isAdminBusy}
                      className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300 disabled:opacity-60"
                    >
                      {isAdminBusy ? 'Preparing...' : 'Prepare DB Indexes'}
                    </button>
                  )}
                  {adminUsers.length > 0 && (
                    <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70">
                      <div className="sticky top-0 border-b border-slate-800 bg-slate-950 p-3">
                        <input
                          value={adminSearchTerm}
                          onChange={(e) => setAdminSearchTerm(e.target.value)}
                          placeholder="Search users..."
                          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                      </div>
                      {filteredAdminUsers.map((user) => (
                        <div key={user.handle} className="flex items-center justify-between gap-3 border-b border-slate-800 p-3 last:border-b-0">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-slate-100">@{user.handle}</div>
                            <div className="text-[10px] font-bold text-slate-500">{user.completedCount}/{user.progressCount} done {user.disabledAt ? '- disabled' : '- active'}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleAdminUser(user)}
                            disabled={isAdminBusy}
                            className={`shrink-0 rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-[0.15em] text-white disabled:opacity-60 ${user.disabledAt ? 'bg-emerald-600' : 'bg-rose-600'}`}
                          >
                            {user.disabledAt ? 'Enable' : 'Disable'}
                          </button>
                        </div>
                      ))}
                      <div className="border-t border-slate-800 p-3">
                        <div className="grid gap-2">
                          <input
                            value={adminResetHandle}
                            onChange={(e) => setAdminResetHandle(e.target.value)}
                            placeholder="username"
                            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                          <input
                            value={adminResetPassword}
                            onChange={(e) => setAdminResetPassword(e.target.value)}
                            type="password"
                            placeholder="new password (4-10 chars)"
                            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                          <button
                            type="button"
                            onClick={handleAdminResetPassword}
                            disabled={isAdminBusy}
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-[9px] font-black uppercase tracking-[0.15em] text-white disabled:opacity-60"
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
                  <div className="bg-slate-950 p-6 rounded-[2rem] border border-slate-800 transition-all focus-within:border-emerald-500/50">
                    <label className="block text-[10px] font-black uppercase text-slate-600 tracking-[0.3em] mb-4 text-center">Username</label>
                    <div className="flex items-center gap-3 text-xl font-mono">
                      <span className="text-emerald-500/40">@</span>
                      <input autoFocus type="text" placeholder="yourname-dsa" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} className="w-full bg-transparent border-none text-emerald-400 focus:ring-0 p-0 placeholder:text-slate-800" />
                    </div>
                  </div>
                  <div className="bg-slate-950 p-6 rounded-[2rem] border border-slate-800 transition-all focus-within:border-emerald-500/50">
                    <label className="block text-[10px] font-black uppercase text-slate-600 tracking-[0.3em] mb-4 text-center">Password</label>
                    <input type="password" placeholder="4-10 characters" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-transparent border-none text-emerald-400 focus:ring-0 p-0 placeholder:text-slate-800" />
                  </div>
                  {authError && <p className="text-center text-xs font-bold text-rose-400">{authError}</p>}
                  <button type="submit" disabled={isAuthBusy} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-[2rem] font-black text-sm tracking-[0.3em] uppercase shadow-2xl shadow-indigo-600/20 transition-all active:scale-95">
                    {isAuthBusy ? 'Working...' : authMode === 'signup' ? 'Create Account' : 'Login'}
                  </button>
              </form>
              )}
           </div>
        </div>
      )}

      {/* Target Focus Overlay (The Random Pick Result) - TRANSPARENT GLASS CARD */}
      {randomPick && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-8 bg-slate-950/40 backdrop-blur-2xl animate-in zoom-in-95 duration-300">
           <div className="bg-[#0f172a]/60 border border-emerald-500/30 rounded-[3rem] p-10 max-w-md w-full text-center relative overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)]">
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
              
              <div className="w-16 h-16 bg-emerald-500/20 rounded-[1.8rem] flex items-center justify-center mx-auto mb-8 text-emerald-400 border border-emerald-500/20">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              
              <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-3">Objective Acquired</p>
              <h3 className="text-2xl font-black text-white mb-6 tracking-tight leading-snug">{randomPick.title}</h3>
              
              <div className="flex justify-center items-center gap-3 mb-10">
                 <DifficultyBadge diff={randomPick.difficulty} />
                 <span className="text-[10px] font-black text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 font-mono">LC #{randomPick.id}</span>
              </div>
              
              <div className="flex flex-col gap-3">
                 <a 
                   href={randomPick.link} 
                   target="_blank" 
                   rel="noreferrer" 
                   onClick={() => setRandomPick(null)} 
                   className="py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                 >
                   Launch LeetCode
                 </a>
                 <button 
                   onClick={() => setRandomPick(null)} 
                   className="py-4 text-slate-500 hover:text-slate-300 font-black text-[9px] uppercase tracking-widest transition-colors"
                 >
                   Dismiss
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
