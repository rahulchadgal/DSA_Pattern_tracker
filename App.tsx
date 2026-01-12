
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DSA_DATA } from './constants';
import { Pattern, Question } from './types';

// --- SUPABASE CONFIG ---
const SB_URL = "https://hbmjpwgwvbtdccdxflxr.supabase.co";
const SB_KEY = "sb_publishable_7QI-0tcuaub-wWk6ZEc2BQ_3GoXjKgk";
const PROFILE_KEY = 'dsa-handle-v4';
const LOCAL_CACHE_KEY = 'dsa-completed-v4';

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

  // --- PROGRESS STATE ---
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(LOCAL_CACHE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'saved' | 'error' | 'idle'>('idle');
  const [selectedPattern, setSelectedPattern] = useState<Pattern>(DSA_DATA[0].patterns[0]);
  const [openSections, setOpenSections] = useState<string[]>([DSA_DATA[0].id]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(!handle);
  const [randomPick, setRandomPick] = useState<Question | null>(null);
  const [viewMode, setViewMode] = useState<'syllabus' | 'random'>('syllabus');

  // --- ATOMIC DATABASE OPERATIONS ---

  const pullRelationalProgress = useCallback(async (userHandle: string) => {
    if (!userHandle) return;
    setSyncStatus('syncing');
    try {
      const response = await fetch(`${SB_URL}/rest/v1/dsa_progress_v4?handle=eq.${userHandle.toLowerCase()}&is_completed=eq.true&select=question_id`, {
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
      });
      const rows = await response.json();
      const ids = rows.map((r: { question_id: string }) => r.question_id);
      
      setCompletedIds(ids);
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(ids));
      setSyncStatus('saved');
    } catch (e) {
      setSyncStatus('error');
    }
  }, []);

  const atomicUpdate = async (qId: string, isChecked: boolean) => {
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
          question_id: qId, 
          is_completed: isChecked,
          updated_at: new Date().toISOString()
        })
      });

      if (response.ok) setSyncStatus('saved');
      else throw new Error();
    } catch (e) {
      setSyncStatus('error');
    }
  };

  // --- SYNC TRIGGERS ---

  useEffect(() => {
    if (handle) {
      pullRelationalProgress(handle);
      const onFocus = () => pullRelationalProgress(handle);
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
    }
  }, [handle, pullRelationalProgress]);

  // --- HANDLERS ---

  const toggleQuestion = (id: string) => {
    const isNowChecked = !completedIds.includes(id);
    const newIds = isNowChecked 
      ? [...completedIds, id] 
      : completedIds.filter(i => i !== id);
    
    setCompletedIds(newIds);
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(newIds));
    atomicUpdate(id, isNowChecked);
  };

  const setupHandle = (e: React.FormEvent) => {
    e.preventDefault();
    if (handle.trim()) {
      const cleanHandle = handle.trim().toLowerCase();
      setHandle(cleanHandle);
      localStorage.setItem(PROFILE_KEY, cleanHandle);
      setShowWelcome(false);
      pullRelationalProgress(cleanHandle);
    }
  };

  const getShareLink = () => `${window.location.origin}${window.location.pathname}?user=${handle}`;

  // --- SEARCH LOGIC ---

  const pickRandom = (scope: 'pattern' | 'global') => {
    let pool: Question[] = [];
    if (scope === 'pattern') {
      pool = selectedPattern.questions.filter(q => !completedIds.includes(q.id));
    } else {
      DSA_DATA.forEach(s => s.patterns.forEach(p => p.questions.forEach(q => {
        if (!completedIds.includes(q.id)) pool.push(q);
      })));
    }

    if (pool.length > 0) {
      setRandomPick(pool[Math.floor(Math.random() * pool.length)]);
    } else {
      alert("Mission Accomplished! No unsolved questions found in this scope.");
    }
  };

  // --- STATS ---

  const patternProgress = useMemo(() => {
    const total = selectedPattern.questions.length;
    const done = selectedPattern.questions.filter(q => completedIds.includes(q.id)).length;
    return Math.round((done / total) * 100);
  }, [selectedPattern, completedIds]);

  const globalStats = useMemo(() => {
    const stats: Record<string, { total: number; solved: number }> = {
      Easy: { total: 0, solved: 0 }, Medium: { total: 0, solved: 0 }, Hard: { total: 0, solved: 0 }
    };
    DSA_DATA.forEach(s => s.patterns.forEach(p => p.questions.forEach(q => {
      if (stats[q.difficulty]) {
        stats[q.difficulty].total++;
        if (completedIds.includes(q.id)) stats[q.difficulty].solved++;
      }
    })));
    return stats;
  }, [completedIds]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar Navigation */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen w-80 bg-[#0f172a] border-r border-slate-800/60 flex flex-col z-50
        transition-transform duration-500 md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-8 border-b border-slate-800/40">
          <h1 className="text-2xl font-black text-white tracking-tighter mb-2 underline decoration-indigo-500 underline-offset-8">DSA ENGINE</h1>
          <div className="mt-4 flex flex-col gap-2">
            <button onClick={() => setShowWelcome(true)} className="flex items-center gap-2 group w-fit text-left">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover:text-white transition-colors">@{handle || 'guest'}</span>
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="px-6 pt-6 grid grid-cols-2 gap-2">
           <button 
             onClick={() => setViewMode('syllabus')}
             className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${viewMode === 'syllabus' ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-600 hover:text-slate-400'}`}
           >
             Syllabus
           </button>
           <button 
             onClick={() => setViewMode('random')}
             className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${viewMode === 'random' ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-600 hover:text-slate-400'}`}
           >
             Roulette
           </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
          {DSA_DATA.map(section => (
            <div key={section.id} className="space-y-1">
              <button 
                onClick={() => setOpenSections(prev => prev.includes(section.id) ? prev.filter(i => i !== section.id) : [...prev, section.id])}
                className="w-full flex items-center justify-between p-3 text-left group"
              >
                <span className={`text-[10px] font-black uppercase tracking-widest ${openSections.includes(section.id) ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400'}`}>{section.title}</span>
                <svg className={`w-3 h-3 text-slate-700 transition-transform ${openSections.includes(section.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              
              {openSections.includes(section.id) && (
                <div className="space-y-1 ml-2">
                  {section.patterns.map(pattern => {
                    const active = selectedPattern.id === pattern.id;
                    const done = pattern.questions.filter(q => completedIds.includes(q.id)).length;
                    const total = pattern.questions.length;
                    const pct = Math.round((done/total)*100);
                    return (
                      <button 
                        key={pattern.id} 
                        onClick={() => { setSelectedPattern(pattern); setViewMode('syllabus'); setIsSidebarOpen(false); }}
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

        <div className="p-8 bg-slate-900/50 border-t border-slate-800/40">
           <div className="flex justify-between items-end mb-3">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Overall Progress</span>
              <span className="text-xl font-black text-white">{Math.round((completedIds.length / 250) * 100)}%</span>
           </div>
           <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-1000" style={{ width: `${(completedIds.length / 250) * 100}%` }} />
           </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="px-8 py-6 md:px-14 md:py-10 border-b border-slate-800/60 bg-[#020617]/80 backdrop-blur-2xl z-20 sticky top-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-3 bg-slate-900 rounded-2xl border border-slate-800 text-slate-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter mb-2">
                  {viewMode === 'syllabus' ? selectedPattern.name : 'Random Objective Picker'}
                </h2>
                <div className="flex flex-wrap gap-3">
                   <CloudStatus status={syncStatus} />
                   <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 rounded-2xl border border-slate-800/50">
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Global Coverage</span>
                      <span className="text-[11px] font-black text-indigo-400 font-mono">{Math.round((completedIds.length / 250) * 100)}%</span>
                   </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
               <div className="flex gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800/50 shadow-inner">
                  {(Object.entries(globalStats) as [string, { total: number; solved: number }][]).map(([diff, data]) => (
                    <GlobalStatBadge key={diff} diff={diff} solved={data.solved} total={data.total} />
                  ))}
               </div>
               <button onClick={() => pickRandom('pattern')} className="p-4 bg-white text-slate-950 rounded-2xl hover:bg-slate-200 transition-all shadow-xl shadow-white/5 active:scale-95">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
               </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 md:p-14 custom-scrollbar">
           {viewMode === 'syllabus' ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 pb-32">
                {selectedPattern.questions.map(q => {
                  const done = completedIds.includes(q.id);
                  return (
                    <div key={q.id} className={`group relative p-8 rounded-[2.5rem] border transition-all duration-500 hover:-translate-y-2 ${done ? 'bg-emerald-500/[0.03] border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-600'}`}>
                       <div className="flex flex-col h-full gap-6">
                          <div className="flex gap-6 items-start">
                             <button 
                               onClick={() => toggleQuestion(q.id)}
                               className={`shrink-0 w-14 h-14 rounded-3xl border-2 flex items-center justify-center transition-all duration-300 ${done ? 'bg-emerald-500 border-transparent text-white shadow-xl shadow-emerald-500/20' : 'bg-slate-950 border-slate-800 text-slate-800 hover:border-slate-500'}`}
                             >
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                             </button>
                             <div className="flex-1 min-w-0 pt-1">
                                <a href={q.link} target="_blank" rel="noreferrer" className={`block text-lg font-bold leading-tight mb-2 transition-all ${done ? 'text-slate-600 line-through opacity-60 italic' : 'text-slate-100 group-hover:text-indigo-400'}`}>{q.title}</a>
                                <div className="flex items-center gap-3">
                                   <span className="text-[10px] font-bold text-slate-700 font-mono tracking-tighter">LC #{q.id}</span>
                                   <DifficultyBadge diff={q.difficulty} />
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                  );
                })}
             </div>
           ) : (
             <div className="max-w-4xl mx-auto py-12 space-y-12">
                <div className="text-center space-y-4">
                   <h3 className="text-4xl font-black text-white tracking-tighter">Objective Roulette</h3>
                   <p className="text-slate-500 font-medium">Break analysis paralysis. Let the engine decide your next target.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                   {/* Option 1: Pattern Scope */}
                   <button 
                     onClick={() => pickRandom('pattern')}
                     className="group relative p-12 rounded-[3.5rem] bg-slate-900/40 border border-slate-800 hover:border-indigo-500/50 transition-all duration-500 hover:-translate-y-2 text-left"
                   >
                      <div className="w-16 h-16 bg-indigo-500/10 rounded-3xl flex items-center justify-center mb-8 border border-indigo-500/20 text-indigo-500 group-hover:scale-110 transition-transform">
                         <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                      </div>
                      <h4 className="text-2xl font-black text-white mb-2 tracking-tight">Pattern Roulette</h4>
                      <p className="text-sm text-slate-500 mb-8 leading-relaxed">Picks a random unsolved question from <span className="text-indigo-400 font-bold">{selectedPattern.name}</span>.</p>
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-500">
                         <span>Start Search</span>
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      </div>
                   </button>

                   {/* Option 2: Global Scope */}
                   <button 
                     onClick={() => pickRandom('global')}
                     className="group relative p-12 rounded-[3.5rem] bg-slate-900/40 border border-slate-800 hover:border-emerald-500/50 transition-all duration-500 hover:-translate-y-2 text-left"
                   >
                      <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center mb-8 border border-emerald-500/20 text-emerald-500 group-hover:scale-110 transition-transform">
                         <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                      </div>
                      <h4 className="text-2xl font-black text-white mb-2 tracking-tight">Global Roulette</h4>
                      <p className="text-sm text-slate-500 mb-8 leading-relaxed">Scans all 250+ questions across the entire syllabus for an unsolved challenge.</p>
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                         <span>Start Search</span>
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      </div>
                   </button>
                </div>
             </div>
           )}
        </div>
      </main>

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
                       <input 
                         autoFocus 
                         type="text" 
                         placeholder="yourname-dsa" 
                         value={handle} 
                         onChange={(e) => setHandle(e.target.value)} 
                         className="w-full bg-transparent border-none text-emerald-400 focus:ring-0 p-0 placeholder:text-slate-800" 
                       />
                    </div>
                 </div>

                 <button type="submit" className="w-full py-7 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2.5rem] font-black text-sm tracking-[0.4em] uppercase shadow-2xl shadow-indigo-600/20 transition-all active:scale-95">Connect Profile</button>
              </form>
           </div>
        </div>
      )}

      {/* Target Focus Overlay (The Random Pick Result) */}
      {randomPick && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-8 bg-slate-950/95 backdrop-blur-2xl animate-in zoom-in-95 duration-300">
           <div className="bg-slate-900 border border-emerald-500/30 rounded-[4rem] p-14 max-w-lg w-full text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
              <div className="w-24 h-24 bg-emerald-500/10 rounded-[3rem] flex items-center justify-center mx-auto mb-10 text-emerald-400 border border-emerald-500/20 shadow-inner">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <p className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.5em] mb-4">Strategic Objective</p>
              <h3 className="text-3xl font-black text-white mb-6 tracking-tight leading-tight">{randomPick.title}</h3>
              <div className="flex justify-center gap-4 mb-12">
                 <DifficultyBadge diff={randomPick.difficulty} />
                 <span className="text-[11px] font-black text-slate-500 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 font-mono tracking-tighter">LC #{randomPick.id}</span>
              </div>
              <div className="flex flex-col gap-4">
                 <a href={randomPick.link} target="_blank" rel="noreferrer" onClick={() => setRandomPick(null)} className="py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-emerald-600/30 transition-all active:scale-95">Go To LeetCode</a>
                 <button onClick={() => setRandomPick(null)} className="py-6 bg-slate-800/50 hover:bg-slate-800 text-slate-500 rounded-[2.5rem] font-bold text-xs uppercase tracking-widest transition-all">Dismiss</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
