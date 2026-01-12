
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DSA_DATA } from './constants';
import { Pattern, Question } from './types';

const STORAGE_KEY = 'dsa-tracker-v7';
const CLOUD_API_BASE = "https://keyvalue.xyz";

// --- UI COMPONENTS ---

const ExternalIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
);

const DiceIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v.01M12 12v.01M12 17v.01M8 12v.01M16 12v.01" /></svg>
);

const DifficultyBadge = ({ diff }: { diff: string }) => {
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

// Fixed TypeScript error by explicitly typing CompactTracker as a React.FC to allow 'key' prop when mapped in JSX
const CompactTracker: React.FC<{ diff: string; solved: number; total: number }> = ({ diff, solved, total }) => {
  const colors = {
    Easy: "text-emerald-500 bg-emerald-500/5 border-emerald-500/20",
    Medium: "text-amber-500 bg-amber-500/5 border-amber-500/20",
    Hard: "text-rose-500 bg-rose-500/5 border-rose-500/20"
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border ${colors[diff as keyof typeof colors]} transition-all cursor-default`}>
      <span className="text-[9px] font-black uppercase tracking-tighter opacity-60">{diff[0]}</span>
      <span className="text-[11px] font-black whitespace-nowrap">
        {solved}<span className="opacity-40 font-bold ml-0.5">/{total}</span>
      </span>
    </div>
  );
};

const App: React.FC = () => {
  // --- STATE ---
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [syncKey, setSyncKey] = useState<string>(() => localStorage.getItem('dsa-sync-key') || `dsa_${Math.random().toString(36).substr(2, 9)}`);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'error' | 'idle'>('idle');
  const [selectedPattern, setSelectedPattern] = useState<Pattern>(DSA_DATA[0].patterns[0]);
  const [openSections, setOpenSections] = useState<string[]>([DSA_DATA[0].id]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [randomPick, setRandomPick] = useState<Question | null>(null);
  
  const isInitialMount = useRef(true);

  // --- LOGIC: SYNC ---
  const performCloudSync = useCallback(async (data: string[]) => {
    if (!syncKey) return;
    setSyncStatus('syncing');
    try {
      const res = await fetch(`${CLOUD_API_BASE}/${syncKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data)
      });
      setSyncStatus(res.ok ? 'synced' : 'error');
    } catch { setSyncStatus('error'); }
  }, [syncKey]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completedIds));
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    const t = setTimeout(() => performCloudSync(completedIds), 2000);
    return () => clearTimeout(t);
  }, [completedIds, performCloudSync]);

  // --- LOGIC: HELPERS ---
  const toggleQuestion = (id: string) => {
    setCompletedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const getPatternProgress = (pattern: Pattern) => {
    const done = pattern.questions.filter(q => completedIds.includes(q.id)).length;
    return Math.round((done / pattern.questions.length) * 100);
  };

  const pickRandomUnsolved = () => {
    const unsolved = selectedPattern.questions.filter(q => !completedIds.includes(q.id));
    if (unsolved.length === 0) {
      alert("All problems in this pattern are completed! Great job!");
      return;
    }
    const picked = unsolved[Math.floor(Math.random() * unsolved.length)];
    setRandomPick(picked);
  };

  // --- GLOBAL STATS CALCULATION ---
  const globalStats = useMemo(() => {
    const stats: Record<string, { total: number; solved: number }> = {
      Easy: { total: 0, solved: 0 },
      Medium: { total: 0, solved: 0 },
      Hard: { total: 0, solved: 0 }
    };

    DSA_DATA.forEach(section => {
      section.patterns.forEach(pattern => {
        pattern.questions.forEach(q => {
          if (stats[q.difficulty]) {
            stats[q.difficulty].total++;
            if (completedIds.includes(q.id)) {
              stats[q.difficulty].solved++;
            }
          }
        });
      });
    });

    return stats;
  }, [completedIds]);

  const totalPossible = useMemo(() => 
    DSA_DATA.reduce((acc, s) => acc + s.patterns.reduce((pA, p) => pA + p.questions.length, 0), 0)
  , []);

  const overallPercent = Math.round((completedIds.length / totalPossible) * 100);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#020617] text-slate-200 font-sans">
      
      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen w-72 bg-[#0f172a] border-r border-slate-800 flex flex-col z-50
        transition-transform duration-300 md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-5 border-b border-slate-800/50 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-white tracking-tighter">DSA <span className="text-emerald-500">ENGINE</span></h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">94 Patterns Curated</p>
          </div>
          <button onClick={() => setShowDataModal(true)} className="p-2 text-slate-500 hover:text-emerald-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
          {DSA_DATA.map(section => (
            <div key={section.id} className="bg-slate-900/10 rounded-xl border border-slate-800/30 overflow-hidden">
              <button 
                onClick={() => setOpenSections(prev => prev.includes(section.id) ? prev.filter(i => i !== section.id) : [...prev, section.id])}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-800/20 transition-all text-left"
              >
                <span className={`text-[10px] font-black uppercase tracking-widest ${openSections.includes(section.id) ? 'text-emerald-500' : 'text-slate-500'}`}>
                  {section.title}
                </span>
                <svg className={`w-3 h-3 transition-transform ${openSections.includes(section.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              
              {openSections.includes(section.id) && (
                <div className="pb-2 px-1 space-y-0.5">
                  {section.patterns.map(pattern => {
                    const active = selectedPattern.id === pattern.id;
                    const pct = getPatternProgress(pattern);
                    return (
                      <button 
                        key={pattern.id}
                        onClick={() => { setSelectedPattern(pattern); setIsSidebarOpen(false); }}
                        className={`w-full group px-3 py-2 rounded-lg text-[12px] text-left transition-all flex flex-col gap-1 ${active ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500 hover:bg-slate-800/40 hover:text-slate-300'}`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="truncate font-semibold">{pattern.name}</span>
                          <span className={`text-[9px] font-black ${pct === 100 ? 'text-emerald-500' : 'opacity-60'}`}>{pct}%</span>
                        </div>
                        <div className="h-1 w-full bg-slate-800/50 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-700 ${pct === 100 ? 'bg-emerald-500' : 'bg-emerald-500/40'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="p-5 bg-slate-900/50 border-t border-slate-800/50">
          <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 mb-2">
            <span>Overall Progress</span>
            <span className="text-emerald-500 font-black">{overallPercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${overallPercent}%` }} />
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Header with Top-Right Global Trackers */}
        <header className="px-6 py-4 md:px-10 md:py-5 border-b border-slate-800 bg-[#020617]/90 backdrop-blur-xl z-20 sticky top-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-slate-900 rounded-lg text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div>
                <h2 className="text-lg md:text-xl font-black text-white leading-tight mb-0.5">{selectedPattern.name}</h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{getPatternProgress(selectedPattern)}% Complete</span>
                  </div>
                  {selectedPattern.videoLink && (
                    <a href={selectedPattern.videoLink} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-colors uppercase tracking-widest flex items-center gap-1 ml-2">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 4-8 4z"/></svg>
                      Theory
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Top Right Compact Trackers */}
            <div className="flex items-center gap-2 md:gap-3 flex-wrap md:flex-nowrap">
              <div className="flex items-center gap-1.5 bg-slate-900/40 p-1 rounded-xl border border-slate-800">
                {(Object.entries(globalStats) as [string, { total: number; solved: number }][]).map(([diff, data]) => (
                  <CompactTracker key={diff} diff={diff} solved={data.solved} total={data.total} />
                ))}
              </div>
              <button 
                onClick={pickRandomUnsolved}
                className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl hover:bg-indigo-500/20 transition-all group shadow-sm"
                title="Pick Random Unsolved"
              >
                <DiceIcon />
              </button>
            </div>
          </div>
        </header>

        {/* Question Suite */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar scroll-smooth">
          
          <div className="flex items-center gap-4 mb-10">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em] shrink-0">Problem Suite</h3>
            <div className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
             {selectedPattern.questions.map(q => {
               const done = completedIds.includes(q.id);
               
               // High-fidelity Difficulty-based Hover Effects
               const hoverStyles = {
                 Easy: "hover:border-emerald-500/50 hover:bg-emerald-500/[0.03] hover:shadow-[0_0_20px_rgba(16,185,129,0.05)]",
                 Medium: "hover:border-amber-500/50 hover:bg-amber-500/[0.03] hover:shadow-[0_0_20px_rgba(245,158,11,0.05)]",
                 Hard: "hover:border-rose-500/50 hover:bg-rose-500/[0.03] hover:shadow-[0_0_20px_rgba(244,63,94,0.05)]"
               };

               const checkStyles = {
                 Easy: "bg-emerald-500 border-emerald-500 shadow-emerald-500/20",
                 Medium: "bg-amber-500 border-amber-500 shadow-amber-500/20",
                 Hard: "bg-rose-500 border-rose-500 shadow-rose-500/20"
               };

               const hoverCheckBorder = {
                 Easy: "hover:border-emerald-500",
                 Medium: "hover:border-amber-500",
                 Hard: "hover:border-rose-500"
               };

               return (
                 <div key={q.id} 
                    className={`group relative p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1 
                    ${hoverStyles[q.difficulty as keyof typeof hoverStyles]}
                    ${done ? 'bg-emerald-500/[0.02] border-emerald-500/20 opacity-70' : 'bg-slate-900/40 border-slate-800/80'}`}
                 >
                    <div className="flex flex-col h-full gap-4">
                       <div className="flex gap-4 items-start">
                          <button 
                            onClick={() => toggleQuestion(q.id)}
                            className={`shrink-0 w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-all 
                            ${done ? `${checkStyles[q.difficulty as keyof typeof checkStyles]} text-white shadow-lg scale-90` : `bg-slate-950 border-slate-800 ${hoverCheckBorder[q.difficulty as keyof typeof hoverCheckBorder]} text-transparent`}`}
                          >
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </button>
                          
                          <div className="flex-1 min-w-0">
                             <a 
                               href={q.link} 
                               target="_blank" 
                               rel="noreferrer" 
                               className={`block text-sm font-bold leading-tight transition-all mb-1.5 ${done ? 'text-slate-500 line-through' : 'text-slate-100 group-hover:text-emerald-400'}`}
                             >
                               {q.title}
                             </a>
                             <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-600 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 uppercase tracking-tighter">#{q.id}</span>
                                <DifficultyBadge diff={q.difficulty} />
                             </div>
                          </div>
                       </div>
                       
                       <div className="mt-auto pt-4 border-t border-slate-800/40 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                             <div className={`w-1 h-1 rounded-full ${done ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'bg-slate-800'}`} />
                             <span className={`text-[9px] font-black uppercase tracking-widest ${done ? 'text-emerald-500' : 'text-slate-600'}`}>
                                {done ? 'Mastered' : 'Unsolved'}
                             </span>
                          </div>
                          <a href={q.link} target="_blank" rel="noreferrer" className="text-slate-700 hover:text-emerald-400 transition-colors">
                            <ExternalIcon />
                          </a>
                       </div>
                    </div>
                 </div>
               );
             })}
          </div>
        </div>
      </main>

      {/* Persistence Modal */}
      {showDataModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl w-full max-w-sm p-8 shadow-2xl relative">
            <button onClick={() => setShowDataModal(false)} className="absolute top-6 right-6 text-slate-600 hover:text-white transition-all">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-2xl font-black text-white mb-2 tracking-tighter">Cloud Backup</h3>
            <p className="text-xs text-slate-400 mb-8 leading-relaxed">Ensure your progress is saved across sessions. Use this key to load your data on any machine.</p>
            
            <div className="space-y-4">
               <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <label className="block text-[9px] font-black uppercase text-slate-500 tracking-widest mb-2">Sync ID</label>
                  <input 
                    type="text" 
                    value={syncKey}
                    onChange={(e) => setSyncKey(e.target.value)}
                    className="w-full bg-transparent border-none text-emerald-400 font-mono text-base focus:ring-0 p-0"
                  />
               </div>
               <div className="flex items-center gap-2 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                  <div className={`w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{syncStatus === 'synced' ? 'Synchronized' : 'Connecting...'}</span>
               </div>
               <button onClick={() => setShowDataModal(false)} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs tracking-widest transition-all shadow-lg uppercase">
                  Close & Save
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Random Pick Modal */}
      {randomPick && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in zoom-in-95 duration-200">
           <div className="bg-slate-900 border border-indigo-500/40 rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl relative overflow-hidden text-center">
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500" />
              <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-indigo-400 border border-indigo-500/20">
                 <DiceIcon />
              </div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2">Random Draw</p>
              <h3 className="text-2xl font-black text-white mb-3">{randomPick.title}</h3>
              <div className="flex justify-center gap-2 mb-8">
                 <DifficultyBadge diff={randomPick.difficulty} />
                 <span className="text-[10px] font-black text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 uppercase tracking-tighter">LC #{randomPick.id}</span>
              </div>
              
              <div className="flex flex-col gap-3">
                 <a 
                   href={randomPick.link} 
                   target="_blank" 
                   rel="noreferrer" 
                   onClick={() => setRandomPick(null)}
                   className="py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-[11px] transition-all uppercase tracking-widest shadow-lg shadow-indigo-500/20"
                 >
                   Open in LeetCode
                 </a>
                 <button 
                   onClick={() => setRandomPick(null)}
                   className="py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl font-bold text-[11px] transition-all uppercase tracking-widest"
                 >
                   Discard Pick
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
