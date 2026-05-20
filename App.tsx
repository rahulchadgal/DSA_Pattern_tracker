
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DSA_DATA } from './constants';
import { Pattern, Question, Section } from './types';

// --- SUPABASE CONFIG ---
const SB_URL = "https://hbmjpwgwvbtdccdxflxr.supabase.co";
const SB_KEY = "sb_publishable_7QI-0tcuaub-wWk6ZEc2BQ_3GoXjKgk";
const PROFILE_KEY = 'dsa-handle-v4';
const LOCAL_CACHE_KEY = 'dsa-completed-v4-map';
const NAVBAR_COLLAPSED_KEY = 'dsa-navbar-collapsed-v1';
const GRID_VIEW_KEY = 'dsa-grid-view-v1';
const CUSTOM_QUESTIONS_CACHE_KEY = 'dsa-custom-questions-v1';
const CUSTOM_QUESTION_TABLE = 'dsa_custom_questions_v1';

type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

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

const CATEGORY_TO_SECTION_ID: Record<string, string> = {
  'Dynamic Programming': 'S5',
  'Sliding Window': 'S2',
  'Graphs': 'S4',
  'Trees': 'S3',
  'Binary Search': 'S9',
  'Greedy': 'S8',
  'Backtracking': 'S7',
  'Stacks': 'S10',
  'Two Pointers': 'S1',
  'Heaps': 'S6'
};

const CATEGORY_OPTIONS = Object.keys(CATEGORY_TO_SECTION_ID);

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

const canonicalQuestionId = (rawId: string): string => {
  const clean = String(rawId || '').trim();
  const numeric = clean.match(/\d+/)?.[0];
  return numeric || clean.toLowerCase();
};


const cloneSections = (sections: Section[]): Section[] => JSON.parse(JSON.stringify(sections));

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

  const alreadyExists = pattern.questions.some(q => q.id === customQuestion.questionId);
  if (alreadyExists) return next;

  pattern.questions.unshift({
    id: customQuestion.questionId,
    title: customQuestion.title,
    fullTitle: `${customQuestion.questionId}. ${customQuestion.title}`,
    link: customQuestion.link,
    difficulty: customQuestion.difficulty
  });

  return next;
};

const mockClassifyQuestion = async (questionId: string): Promise<LcMetadata> => {
  const normalized = questionId.trim();
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

const CloudStatus: React.FC<{ status: 'syncing' | 'saved' | 'error' | 'idle' }> = ({ status }) => {
  const configs = {
    syncing: { color: "bg-amber-400", label: "Syncing..." },
    saved: { color: "bg-emerald-500", label: "Relational Sync Active" },
    error: { color: "bg-rose-500", label: "Sync Offline" },
    idle: { color: "bg-slate-600", label: "Connecting..." }
  };
  const cfg = configs[status];
  
  return (
    <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-900/60 rounded-2xl border border-slate-800/50 backdrop-blur-xl">
      <div className={`w-2 h-2 rounded-full ${cfg.color} ${status === 'syncing' ? 'animate-pulse' : ''}`} />
      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{cfg.label}</span>
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

const App: React.FC = () => {
  // --- IDENTITY ---
  const [handle, setHandle] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlHandle = urlParams.get('user');
    if (urlHandle) {
      localStorage.setItem(PROFILE_KEY, urlHandle.toLowerCase());
      window.history.replaceState({}, '', window.location.pathname);
      return urlHandle.toLowerCase();
    }
    return localStorage.getItem(PROFILE_KEY) || '';
  });

  // --- PROGRESS STATE (Map of ID -> Timestamp) ---
  const [completedMap, setCompletedMap] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(LOCAL_CACHE_KEY);
    return saved ? JSON.parse(saved) : {};
  });
  
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'saved' | 'error' | 'idle'>('idle');
  const [sectionsData, setSectionsData] = useState<Section[]>(() => cloneSections(DSA_DATA));
  const [selectedPattern, setSelectedPattern] = useState<Pattern>(DSA_DATA[0].patterns[0]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(DSA_DATA[0].id);
  const [openSections, setOpenSections] = useState<string[]>([DSA_DATA[0].id]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => localStorage.getItem(NAVBAR_COLLAPSED_KEY) === 'true');
  const [showWelcome, setShowWelcome] = useState(!handle);
  const [randomPick, setRandomPick] = useState<Question | null>(null);
  const [viewMode, setViewMode] = useState<'syllabus' | 'random'>('syllabus');
  const [gridView, setGridView] = useState<'list' | 'small' | 'big'>(() => {
    const saved = localStorage.getItem(GRID_VIEW_KEY);
    return saved === 'list' || saved === 'small' || saved === 'big' ? saved : 'big';
  });
  const [activeScreen, setActiveScreen] = useState<'main' | 'profile'>('main');
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [questionIdInput, setQuestionIdInput] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<LcMetadata | null>(null);
  const [manualCategory, setManualCategory] = useState<string>('Dynamic Programming');
  const [isClassifying, setIsClassifying] = useState(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);

  // --- ATOMIC DATABASE OPERATIONS ---

  const pullRelationalProgress = useCallback(async (userHandle: string) => {
    if (!userHandle) return;
    setSyncStatus('syncing');
    try {
      const response = await fetch(`${SB_URL}/rest/v1/dsa_progress_v4?handle=eq.${userHandle.toLowerCase()}&is_completed=eq.true&select=question_id,updated_at`, {
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
      });
      const rows = await response.json();
      const map: Record<string, string> = {};
      rows.forEach((r: { question_id: string, updated_at: string }) => {
        map[canonicalQuestionId(r.question_id)] = r.updated_at;
      });
      
      setCompletedMap(map);
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(map));
      setSyncStatus('saved');
    } catch (e) {
      setSyncStatus('error');
    }
  }, []);

  const atomicUpdate = async (qId: string, isChecked: boolean, timestamp: string) => {
    if (!handle) return;
    setSyncStatus('syncing');
    try {
      const response = await fetch(`${SB_URL}/rest/v1/dsa_progress_v4`, {
        method: 'POST',
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ 
          handle: handle.toLowerCase(), 
          question_id: canonicalQuestionId(qId), 
          is_completed: isChecked,
          updated_at: timestamp
        })
      });

      if (response.ok) setSyncStatus('saved');
      else throw new Error();
    } catch (e) {
      setSyncStatus('error');
    }
  };


  const saveCustomQuestion = async (question: CustomQuestionRow) => {
    if (!handle) return;
    try {
      await fetch(`${SB_URL}/rest/v1/${CUSTOM_QUESTION_TABLE}`, {
        method: 'POST',
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          handle: handle.toLowerCase(),
          question_id: question.questionId,
          title: question.title,
          difficulty: question.difficulty,
          category: question.category,
          section_id: question.sectionId,
          pattern_id: question.patternId,
          link: question.link,
          updated_at: new Date().toISOString()
        })
      });
    } catch (error) {
      // local-first fallback; keeps UI responsive even if network fails
    }
  };

  const pullCustomQuestions = useCallback(async (userHandle: string) => {
    const fromCache = localStorage.getItem(CUSTOM_QUESTIONS_CACHE_KEY);
    if (fromCache) {
      const cachedRows: CustomQuestionRow[] = JSON.parse(fromCache);
      setSectionsData(prev => cachedRows.reduce((acc, row) => addCustomQuestionToSections(acc, row), prev));
    }

    if (!userHandle) return;

    try {
      const response = await fetch(`${SB_URL}/rest/v1/${CUSTOM_QUESTION_TABLE}?handle=eq.${userHandle.toLowerCase()}&select=question_id,title,difficulty,category,section_id,pattern_id,link`, {
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
      });
      if (!response.ok) return;
      const rows = await response.json();
      const normalizedRows: CustomQuestionRow[] = rows.map((row: any) => ({
        questionId: row.question_id,
        title: row.title,
        difficulty: row.difficulty,
        category: row.category,
        sectionId: row.section_id,
        patternId: row.pattern_id,
        link: row.link
      }));

      localStorage.setItem(CUSTOM_QUESTIONS_CACHE_KEY, JSON.stringify(normalizedRows));
      setSectionsData(cloneSections(DSA_DATA));
      setSectionsData(prev => normalizedRows.reduce((acc, row) => addCustomQuestionToSections(acc, row), prev));
    } catch (error) {
      // keep cached/local data only
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

    const selectedCategory = manualCategory in CATEGORY_TO_SECTION_ID ? manualCategory : 'Dynamic Programming';
    const sectionId = CATEGORY_TO_SECTION_ID[selectedCategory] || 'S5';
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
    setIsSavingQuestion(false);
  };

  // --- SYNC TRIGGERS ---

  useEffect(() => {
    if (handle) {
      pullRelationalProgress(handle);
      pullCustomQuestions(handle);
      const onFocus = () => pullRelationalProgress(handle);
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
    }
  }, [handle, pullRelationalProgress, pullCustomQuestions]);

  useEffect(() => {
    const cachedRows: CustomQuestionRow[] = JSON.parse(localStorage.getItem(CUSTOM_QUESTIONS_CACHE_KEY) || '[]');
    if (cachedRows.length) {
      setSectionsData(prev => cachedRows.reduce((acc, row) => addCustomQuestionToSections(acc, row), prev));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(NAVBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem(GRID_VIEW_KEY, gridView);
  }, [gridView]);

  // --- HANDLERS ---

  const toggleQuestion = (id: string) => {
    const normalizedId = canonicalQuestionId(id);
    const isNowChecked = !completedMap[normalizedId];
    const timestamp = new Date().toISOString();
    const nextMap = { ...completedMap };
    
    if (isNowChecked) {
      nextMap[normalizedId] = timestamp;
    } else {
      delete nextMap[normalizedId];
    }
    
    setCompletedMap(nextMap);
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(nextMap));
    atomicUpdate(normalizedId, isNowChecked, timestamp);
  };

  const setupHandle = (e: React.FormEvent) => {
    e.preventDefault();
    if (handle.trim()) {
      const cleanHandle = handle.trim().toLowerCase();
      setHandle(cleanHandle);
      localStorage.setItem(PROFILE_KEY, cleanHandle);
      setShowWelcome(false);
      pullRelationalProgress(cleanHandle);
      pullCustomQuestions(cleanHandle);
    }
  };

  // --- SEARCH LOGIC ---

  const pickRandom = (scope: 'section' | 'global') => {
    let pool: Question[] = [];
    if (scope === 'section') {
      const section = sectionsData.find(s => s.id === selectedSectionId);
      section?.patterns.forEach(p => p.questions.forEach(q => {
        if (!completedMap[canonicalQuestionId(q.id)]) pool.push(q);
      }));
    } else {
      sectionsData.forEach(s => s.patterns.forEach(p => p.questions.forEach(q => {
        if (!completedMap[canonicalQuestionId(q.id)]) pool.push(q);
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
        if (completedMap[canonicalQuestionId(q.id)]) solved++;
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
        if (completedMap[canonicalQuestionId(q.id)]) stats[q.difficulty].solved++;
      }
    })));
    return stats;
  }, [completedMap, sectionsData]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar Navigation */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen bg-[#0f172a] border-r border-slate-800/60 flex flex-col z-50
        transition-all duration-500 md:translate-x-0 ${isSidebarCollapsed ? 'md:w-24' : 'md:w-80'} w-80
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className={`${isSidebarCollapsed ? 'p-4' : 'p-8'} border-b border-slate-800/40`}>
          <div className="flex items-center justify-between gap-2">
            {!isSidebarCollapsed && <h1 className="text-2xl font-black text-white tracking-tighter mb-2 underline decoration-indigo-500 underline-offset-8">DSA ENGINE</h1>}
            {isSidebarCollapsed && <h1 className="text-lg font-black text-white tracking-tighter">DSA</h1>}
            <button
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              className="hidden md:flex p-2 bg-slate-900 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200"
              title={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              <svg className={`w-4 h-4 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <button onClick={() => setShowWelcome(true)} className="flex items-center gap-2 group w-fit text-left">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {!isSidebarCollapsed && <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover:text-white transition-colors">@{handle || 'guest'}</span>}
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
          {sectionsData.map(section => (
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
                    const active = selectedPattern.id === pattern.id;
                    const doneCount = pattern.questions.filter(q => completedMap[canonicalQuestionId(q.id)]).length;
                    const total = pattern.questions.length;
                    const pct = Math.round((doneCount/total)*100);
                    return (
                      <button 
                        key={pattern.id} 
                        onClick={() => { setSelectedPattern(pattern); setSelectedSectionId(section.id); setViewMode('syllabus'); setIsSidebarOpen(false); }}
                        className={`w-full group px-4 py-3 rounded-2xl text-[12px] text-left transition-all border ${active ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-lg shadow-indigo-500/5' : 'text-slate-500 hover:bg-slate-800/40 border-transparent'}`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="truncate font-bold tracking-tight pr-4">{pattern.name}</span>
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

        <div className={`${isSidebarCollapsed ? 'p-4' : 'p-8'} bg-slate-900/50 border-t border-slate-800/40`}>
           <div className="flex justify-between items-end mb-3">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Overall Progress</span>
              <span className="text-xl font-black text-white">{Math.round((Object.keys(completedMap).length / 250) * 100)}%</span>
           </div>
           <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-1000" style={{ width: `${(Object.keys(completedMap).length / 250) * 100}%` }} />
           </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="px-8 py-6 md:px-14 md:py-8 border-b border-slate-800/60 bg-[#020617]/80 backdrop-blur-2xl z-20 sticky top-0">
          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-3 bg-slate-900 rounded-2xl border border-slate-800 text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <button onClick={() => setIsSidebarCollapsed(prev => !prev)} className="hidden md:flex p-3 bg-slate-900 rounded-2xl border border-slate-800 text-slate-400">
                <svg className={`w-5 h-5 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tighter">
                  {activeScreen === 'profile' ? 'Profile Settings' : viewMode === 'syllabus' ? selectedPattern.name : 'Objective Selection'}
                </h2>
                <div className="flex items-center gap-3 mt-1.5">
                   <CloudStatus status={syncStatus} />
                   <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-900/60 rounded-xl border border-slate-800/50">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Global</span>
                      <span className="text-[10px] font-black text-indigo-400 font-mono">{Math.round((Object.keys(completedMap).length / 250) * 100)}%</span>
                   </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
               <div className="hidden lg:flex gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/50">
                  {(Object.entries(globalStats) as [string, { total: number; solved: number }][]).map(([diff, data]) => (
                    <GlobalStatBadge key={diff} diff={diff} solved={data.solved} total={data.total} />
                  ))}
               </div>

               {/* Header Mode Switcher */}
               <div className="flex p-1 bg-slate-950 rounded-2xl border border-slate-800/80 shadow-inner">
                  <button
                    onClick={() => setActiveScreen('main')}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeScreen === 'main' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Main
                  </button>
                  <button
                    onClick={() => setActiveScreen('profile')}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeScreen === 'profile' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Profile
                  </button>
               </div>
               {activeScreen === 'main' && (
                 <div className="hidden sm:flex p-1 bg-slate-950 rounded-2xl border border-slate-800/80 shadow-inner">
                    <button 
                      onClick={() => setViewMode('syllabus')}
                      className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'syllabus' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Syllabus
                    </button>
                    <button 
                      onClick={() => setViewMode('random')}
                      className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'random' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Roulette
                    </button>
                 </div>
               )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 md:p-14 custom-scrollbar">
           {activeScreen === 'profile' ? (
             <div className="max-w-3xl mx-auto">
               <div className="rounded-[2.5rem] border border-slate-800/70 bg-slate-900/40 p-8 md:p-12">
                 <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-black">Profile Settings</p>
                 <h3 className="mt-3 text-3xl font-black text-white tracking-tight">Add New Question</h3>
                 <p className="mt-3 text-sm text-slate-400">Use a LeetCode ID and let AI suggest the pattern category. You can review and confirm before save.</p>
                 <button
                   onClick={() => { setShowAddQuestionModal(true); setAiSuggestion(null); }}
                   className="mt-8 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-[0.2em]"
                 >
                   Add New Question
                 </button>
               </div>
             </div>
           ) : viewMode === 'syllabus' ? (
             <>
               <div className="mb-8 flex items-center gap-3">
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">View Settings</span>
                 <div className="flex p-1 bg-slate-950 rounded-2xl border border-slate-800/80 shadow-inner">
                   {([
                     ['list', 'List View'],
                     ['small', 'Small Icons'],
                     ['big', 'Big Icons']
                   ] as const).map(([mode, label]) => (
                     <button
                       key={mode}
                       onClick={() => setGridView(mode)}
                       className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${gridView === mode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                     >
                       {label}
                     </button>
                   ))}
                 </div>
               </div>
               <div className={`pb-32 ${gridView === 'list' ? 'flex flex-col gap-4 max-w-4xl' : gridView === 'small' ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4' : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6'}`}>
                {selectedPattern.questions.map(q => {
                  const timestamp = completedMap[canonicalQuestionId(q.id)];
                  const done = !!timestamp;
                  return (
                    <div key={q.id} className={`group relative border transition-all duration-500 ${gridView === 'small' ? 'p-5 rounded-3xl' : gridView === 'list' ? 'p-5 rounded-2xl' : 'p-8 rounded-[2.5rem] hover:-translate-y-2'} ${done ? 'bg-emerald-500/[0.03] border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-600'}`}>
                       <div className={`flex flex-col h-full ${gridView === 'small' ? 'gap-3' : 'gap-6'}`}>
                          <div className={`flex items-start ${gridView === 'small' ? 'gap-3' : 'gap-6'}`}>
                             <button 
                               onClick={() => toggleQuestion(q.id)}
                               className={`shrink-0 ${gridView === 'small' ? 'w-10 h-10 rounded-2xl' : 'w-14 h-14 rounded-3xl'} border-2 flex items-center justify-center transition-all duration-300 ${done ? 'bg-emerald-500 border-transparent text-white shadow-xl shadow-emerald-500/20' : 'bg-slate-950 border-slate-800 text-slate-800 hover:border-slate-500'}`}
                             >
                                <svg className={`${gridView === 'small' ? 'w-5 h-5' : 'w-7 h-7'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                             </button>
                             <div className="flex-1 min-w-0 pt-1">
                                <a href={q.link} target="_blank" rel="noreferrer" className={`block ${gridView === 'small' ? 'text-sm' : 'text-lg'} font-bold leading-tight mb-2 transition-all ${done ? 'text-slate-600 line-through opacity-60 italic' : 'text-slate-100 group-hover:text-indigo-400'}`}>{q.title}</a>
                                <div className="flex items-center gap-3">
                                   <span className="text-[10px] font-bold text-slate-700 font-mono tracking-tighter">LC #{q.id}</span>
                                   <DifficultyBadge diff={q.difficulty} />
                                </div>
                             </div>
                          </div>
                          
                          {/* Last Updated Timestamp */}
                          {done && gridView !== 'small' && (
                            <div className="flex flex-col gap-1 border-t border-emerald-500/10 pt-4 animate-in fade-in slide-in-from-top-1 duration-700">
                               <span className="text-[8px] font-black uppercase text-emerald-500/50 tracking-[0.2em]">Last Updated</span>
                               <span className="text-[10px] font-bold text-slate-400 font-mono italic">
                                  {formatDate(timestamp)}
                               </span>
                            </div>
                          )}
                       </div>
                    </div>
                  );
                })}
               </div>
             </>
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
                 <div className="w-20 h-20 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border border-emerald-500/20 text-emerald-500">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                 </div>
                 <h3 className="text-4xl font-black text-white mb-4 tracking-tighter leading-none">Universal Link</h3>
                 <p className="text-sm text-slate-500 leading-relaxed font-medium">Use a unique handle to sync your progress question-by-question across all your devices.</p>
              </div>
              <form onSubmit={setupHandle} className="space-y-8">
                 <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 transition-all focus-within:border-emerald-500/50">
                    <label className="block text-[10px] font-black uppercase text-slate-600 tracking-[0.3em] mb-4 text-center">Global Handle</label>
                    <div className="flex items-center gap-3 text-2xl font-mono">
                       <span className="text-emerald-500/40">@</span>
                       <input autoFocus type="text" placeholder="yourname-dsa" value={handle} onChange={(e) => setHandle(e.target.value)} className="w-full bg-transparent border-none text-emerald-400 focus:ring-0 p-0 placeholder:text-slate-800" />
                    </div>
                 </div>
                 <button type="submit" className="w-full py-7 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2.5rem] font-black text-sm tracking-[0.4em] uppercase shadow-2xl shadow-indigo-600/20 transition-all active:scale-95">Connect Profile</button>
              </form>
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
