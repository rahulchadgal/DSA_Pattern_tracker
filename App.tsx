
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DSA_DATA } from './constants';
import { Pattern, Question, Section } from './types';

// --- SUPABASE CONFIG ---
const SB_URL = "https://hbmjpwgwvbtdccdxflxr.supabase.co";
const SB_KEY = "sb_publishable_7QI-0tcuaub-wWk6ZEc2BQ_3GoXjKgk";
const PROFILE_KEY = 'dsa-handle-v4';
const LOCAL_CACHE_KEY = 'dsa-completed-v4-map';

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
  const [selectedPattern, setSelectedPattern] = useState<Pattern>(DSA_DATA[0].patterns[0]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(DSA_DATA[0].id);
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
      const response = await fetch(`${SB_URL}/rest/v1/dsa_progress_v4?handle=eq.${userHandle.toLowerCase()}&is_completed=eq.true&select=question_id,updated_at`, {
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
      });
      const rows = await response.json();
      const map: Record<string, string> = {};
      rows.forEach((r: { question_id: string, updated_at: string }) => {
        map[r.question_id] = r.updated_at;
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
          question_id: qId, 
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
    const isNowChecked = !completedMap[id];
    const timestamp = new Date().toISOString();
    const nextMap = { ...completedMap };
    
    if (isNowChecked) {
      nextMap[id] = timestamp;
    } else {
      delete nextMap[id];
    }
    
    setCompletedMap(nextMap);
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(nextMap));
    atomicUpdate(id, isNowChecked, timestamp);
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

  // --- SEARCH LOGIC ---

  const pickRandom = (scope: 'section' | 'global') => {
    let pool: Question[] = [];
    if (scope === 'section') {
      const section = DSA_DATA.find(s => s.id === selectedSectionId);
      section?.patterns.forEach(p => p.questions.forEach(q => {
        if (!completedMap[q.id]) pool.push(q);
      }));
    } else {
      DSA_DATA.forEach(s => s.patterns.forEach(p => p.questions.forEach(q => {
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
    return DSA_DATA.map(section => {
      let total = 0;
      let solved = 0;
      section.patterns.forEach(p => p.questions.forEach(q => {
        total++;
        if (completedMap[q.id]) solved++;
      }));
      return { id: section.id, title: section.title, solved, total };
    });
  }, [completedMap]);

  const currentSectionData = useMemo(() => {
    return sectionStats.find(s => s.id === selectedSectionId);
  }, [sectionStats, selectedSectionId]);

  const globalStats = useMemo(() => {
    const stats: Record<string, { total: number; solved: number }> = {
      Easy: { total: 0, solved: 0 }, Medium: { total: 0, solved: 0 }, Hard: { total: 0, solved: 0 }
    };
    DSA_DATA.forEach(s => s.patterns.forEach(p => p.questions.forEach(q => {
      if (stats[q.difficulty]) {
        stats[q.difficulty].total++;
        if (completedMap[q.id]) stats[q.difficulty].solved++;
      }
    })));
    return stats;
  }, [completedMap]);

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
                    const doneCount = pattern.questions.filter(q => completedMap[q.id]).length;
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

        <div className="p-8 bg-slate-900/50 border-t border-slate-800/40">
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
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tighter">
                  {viewMode === 'syllabus' ? selectedPattern.name : 'Objective Selection'}
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
                    onClick={() => setViewMode('syllabus')}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'syllabus' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Syllabus
                  </button>
                  <button 
                    onClick={() => setViewMode('random')}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'random' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Roulette
                  </button>
               </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 md:p-14 custom-scrollbar">
           {viewMode === 'syllabus' ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 pb-32">
                {selectedPattern.questions.map(q => {
                  const timestamp = completedMap[q.id];
                  const done = !!timestamp;
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
                          
                          {/* Last Updated Timestamp */}
                          {done && (
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
                                {DSA_DATA.map(s => (
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
