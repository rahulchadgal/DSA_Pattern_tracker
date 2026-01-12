
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DSA_DATA } from './constants';
import { Pattern, Question } from './types';

// --- SUPABASE CONFIG ---
const SB_URL = "https://hbmjpwgwvbtdccdxflxr.supabase.co";
const SB_KEY = "sb_publishable_7QI-0tcuaub-wWk6ZEc2BQ_3GoXjKgk";
const STORAGE_KEY = 'dsa-tracker-v11-auto';

// --- UI COMPONENTS ---

const CloudPulse = ({ status }: { status: 'syncing' | 'saved' | 'error' | 'idle' }) => {
  const colors = {
    syncing: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
    saved: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]",
    error: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]",
    idle: "bg-slate-700"
  };
  const labels = { syncing: "Syncing...", saved: "Cloud Saved", error: "Sync Error", idle: "Cloud Ready" };
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 rounded-full border border-slate-800 backdrop-blur-md">
      <div className={`w-1.5 h-1.5 rounded-full ${colors[status]} ${status === 'syncing' ? 'animate-pulse' : ''}`} />
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{labels[status]}</span>
    </div>
  );
};

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
  // --- IDENTITY LOGIC ---
  const [syncKey] = useState(() => {
    // 1. Check URL for pairing key
    const urlParams = new URLSearchParams(window.location.search);
    const pairingKey = urlParams.get('pair');
    if (pairingKey) {
      localStorage.setItem('dsa-sync-key-auto', pairingKey);
      window.history.replaceState({}, '', window.location.pathname); // Clear URL
      return pairingKey;
    }
    // 2. Check local storage
    const existing = localStorage.getItem('dsa-sync-key-auto');
    if (existing) return existing;
    // 3. Generate new
    const generated = `dev-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('dsa-sync-key-auto', generated);
    return generated;
  });

  // --- STATE ---
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'saved' | 'error' | 'idle'>('idle');
  const [selectedPattern, setSelectedPattern] = useState<Pattern>(DSA_DATA[0].patterns[0]);
  const [openSections, setOpenSections] = useState<string[]>([DSA_DATA[0].id]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [randomPick, setRandomPick] = useState<Question | null>(null);

  // --- SYNC ACTIONS ---
  const pushToCloud = useCallback(async (data: string[]) => {
    setSyncStatus('syncing');
    try {
      const response = await fetch(`${SB_URL}/rest/v1/dsa_sync`, {
        method: 'POST',
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ id: syncKey, data })
      });
      if (response.ok) setSyncStatus('saved');
      else throw new Error();
    } catch (e) {
      setSyncStatus('error');
    }
  }, [syncKey]);

  const pullFromCloud = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      const response = await fetch(`${SB_URL}/rest/v1/dsa_sync?id=eq.${syncKey}&select=data`, {
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
      });
      const results = await response.json();
      if (results && results.length > 0) {
        setCompletedIds(results[0].data);
        setSyncStatus('saved');
      } else {
        setSyncStatus('idle');
      }
    } catch (e) {
      setSyncStatus('error');
    }
  }, [syncKey]);

  // --- PERSISTENCE & AUTO-SYNC ---
  useEffect(() => {
    // Initial Pull on Load
    pullFromCloud();
  }, [pullFromCloud]);

  useEffect(() => {
    // Local Persistence
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completedIds));

    // Debounced Cloud Sync
    const timeout = setTimeout(() => {
      pushToCloud(completedIds);
    }, 1500); // 1.5s delay after last change

    return () => clearTimeout(timeout);
  }, [completedIds, pushToCloud]);

  // --- HELPERS ---
  const toggleQuestion = (id: string) => {
    setCompletedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const getPatternProgress = (pattern: Pattern) => {
    const done = pattern.questions.filter(q => completedIds.includes(q.id)).length;
    return Math.round((done / pattern.questions.length) * 100);
  };

  const pickRandomUnsolved = () => {
    const unsolved = selectedPattern.questions.filter(q => !completedIds.includes(q.id));
    if (unsolved.length === 0) return;
    const picked = unsolved[Math.floor(Math.random() * unsolved.length)];
    setRandomPick(picked);
  };

  const getPairingUrl = () => `${window.location.origin}${window.location.pathname}?pair=${syncKey}`;

  // --- STATS ---
  const globalStats = useMemo(() => {
    const stats: Record<string, { total: number; solved: number }> = {
      Easy: { total: 0, solved: 0 }, Medium: { total: 0, solved: 0 }, Hard: { total: 0, solved: 0 }
    };
    DSA_DATA.forEach(section => {
      section.patterns.forEach(pattern => {
        pattern.questions.forEach(q => {
          if (stats[q.difficulty]) {
            stats[q.difficulty].total++;
            if (completedIds.includes(q.id)) stats[q.difficulty].solved++;
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
    <div className="flex flex-col md:flex-row min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/30">
      
      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen w-72 bg-[#0f172a] border-r border-slate-800/60 flex flex-col z-50
        transition-transform duration-300 md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-800/40 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter">DSA <span className="text-emerald-500">ENGINE</span></h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Auto-Sync Enabled</p>
          </div>
          <button onClick={() => setShowDataModal(true)} className="p-2.5 bg-slate-900 rounded-xl text-slate-400 hover:text-sky-400 transition-colors border border-slate-800">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.803a4 4 0 015.656 0l4 4a4 4 0 11-5.656 5.656l-1.1-1.1" /></svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
          {DSA_DATA.map(section => (
            <div key={section.id} className="bg-slate-900/20 rounded-2xl border border-slate-800/30 overflow-hidden">
              <button onClick={() => setOpenSections(prev => prev.includes(section.id) ? prev.filter(i => i !== section.id) : [...prev, section.id])} className="w-full flex items-center justify-between p-4 hover:bg-slate-800/20 text-left transition-colors">
                <span className={`text-[10px] font-black uppercase tracking-widest ${openSections.includes(section.id) ? 'text-emerald-500' : 'text-slate-500'}`}>{section.title}</span>
                <svg className={`w-3 h-3 transition-transform ${openSections.includes(section.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {openSections.includes(section.id) && (
                <div className="pb-3 px-2 space-y-1">
                  {section.patterns.map(pattern => {
                    const active = selectedPattern.id === pattern.id;
                    const pct = getPatternProgress(pattern);
                    return (
                      <button key={pattern.id} onClick={() => { setSelectedPattern(pattern); setIsSidebarOpen(false); }} className={`w-full group px-3 py-2.5 rounded-xl text-[12px] text-left transition-all flex flex-col gap-1.5 ${active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'text-slate-500 hover:bg-slate-800/40 border border-transparent'}`}>
                        <div className="flex justify-between items-center w-full">
                          <span className="truncate font-bold tracking-tight">{pattern.name}</span>
                          <span className={`text-[9px] font-black ${pct === 100 ? 'text-emerald-500' : 'opacity-40'}`}>{pct}%</span>
                        </div>
                        <div className="h-1 w-full bg-slate-800/50 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-1000 ${pct === 100 ? 'bg-emerald-500' : 'bg-emerald-500/40'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="p-6 bg-slate-900/50 border-t border-slate-800/40">
          <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 mb-2.5">
            <span>Overall Score</span>
            <span className="text-emerald-500">{overallPercent}%</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${overallPercent}%` }} />
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="px-6 py-5 md:px-12 md:py-8 border-b border-slate-800 bg-[#020617]/95 backdrop-blur-3xl z-20 sticky top-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2.5 bg-slate-900 rounded-xl border border-slate-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white leading-tight mb-1">{selectedPattern.name}</h2>
                <div className="flex items-center gap-3">
                   <CloudPulse status={syncStatus} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                {(Object.entries(globalStats) as [string, { total: number; solved: number }][]).map(([diff, data]) => (
                  <CompactTracker key={diff} diff={diff} solved={data.solved} total={data.total} />
                ))}
              </div>
              <button onClick={pickRandomUnsolved} className="p-3 bg-indigo-500 text-white rounded-2xl hover:bg-indigo-400 shadow-xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2 px-5">
                <DiceIcon />
                <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">Lucky Pick</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar scroll-smooth">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 pb-24">
             {selectedPattern.questions.map(q => {
               const done = completedIds.includes(q.id);
               const hoverColors = { Easy: "hover:border-emerald-500/50", Medium: "hover:border-amber-500/50", Hard: "hover:border-rose-500/50" };
               const checkColors = { Easy: "bg-emerald-500", Medium: "bg-amber-500", Hard: "bg-rose-500" };
               return (
                 <div key={q.id} className={`group relative p-6 rounded-[2rem] border transition-all duration-500 hover:-translate-y-2 ${hoverColors[q.difficulty as keyof typeof hoverColors]} ${done ? 'bg-emerald-500/[0.03] border-emerald-500/30' : 'bg-slate-900/40 border-slate-800/80'}`}>
                    <div className="flex flex-col h-full gap-5">
                       <div className="flex gap-5 items-start">
                          <button onClick={() => toggleQuestion(q.id)} className={`shrink-0 w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 ${done ? `${checkColors[q.difficulty as keyof typeof checkColors]} text-white border-transparent shadow-lg` : `bg-slate-950 border-slate-800 hover:border-slate-400 text-slate-700`}`}>
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <div className="flex-1 min-w-0">
                             <a href={q.link} target="_blank" rel="noreferrer" className={`block text-base font-bold leading-snug mb-2 transition-colors duration-300 ${done ? 'text-slate-500 line-through opacity-60' : 'text-slate-100 group-hover:text-emerald-400'}`}>{q.title}</a>
                             <div className="flex items-center gap-2.5">
                                <span className="text-[10px] font-black text-slate-600 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono tracking-tighter">LC #{q.id}</span>
                                <DifficultyBadge diff={q.difficulty} />
                             </div>
                          </div>
                       </div>
                       <div className="mt-auto pt-5 border-t border-slate-800/40 flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${done ? 'text-emerald-500' : 'text-slate-700'}`}>{done ? 'Mastered' : 'Queued'}</span>
                          <a href={q.link} target="_blank" rel="noreferrer" className="p-2 text-slate-700 hover:text-emerald-400 transition-colors"><ExternalIcon /></a>
                       </div>
                    </div>
                 </div>
               );
             })}
          </div>
        </div>
      </main>

      {/* Auto-Sync Connectivity Modal */}
      {showDataModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="bg-[#0f172a] border border-slate-800 rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-sky-500" />
            <button onClick={() => setShowDataModal(false)} className="absolute top-8 right-8 text-slate-600 hover:text-white transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            
            <div className="text-center mb-8">
               <h3 className="text-3xl font-black text-white mb-2 tracking-tighter">Device Pairing</h3>
               <p className="text-xs text-slate-400 leading-relaxed font-medium">Link other browsers to this progress without using a key.</p>
            </div>

            <div className="space-y-6">
               <div className="bg-slate-950 p-5 rounded-[1.5rem] border border-slate-800 relative group">
                  <label className="block text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] mb-3">Your Unique Link</label>
                  <div className="flex items-center gap-3">
                    <input readOnly value={getPairingUrl()} className="flex-1 bg-transparent border-none text-sky-400 font-mono text-xs focus:ring-0 p-0 truncate" />
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(getPairingUrl()); alert('Link copied!'); }} className="absolute bottom-5 right-5 text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-400 transition-colors">Copy Link</button>
               </div>

               <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                 <p className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Zero-Touch Sync</p>
                 <p className="text-[10px] text-slate-500 leading-snug">The engine automatically backs up your data every time you solve a problem. No buttons required.</p>
               </div>
               
               <button onClick={() => setShowDataModal(false)} className="w-full py-5 bg-sky-600 hover:bg-sky-500 text-white rounded-[1.5rem] font-black text-xs tracking-[0.3em] uppercase mt-2 shadow-2xl shadow-sky-500/20 transition-all active:scale-95">Back to Work</button>
            </div>
          </div>
        </div>
      )}

      {/* Lucky pick overlay */}
      {randomPick && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in zoom-in-95 duration-200">
           <div className="bg-slate-900 border border-indigo-500/30 rounded-[3rem] p-12 max-w-md w-full shadow-[0_0_50px_rgba(99,102,241,0.15)] relative overflow-hidden text-center">
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
              <div className="w-20 h-20 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-indigo-400 border border-indigo-500/20 shadow-inner"><DiceIcon /></div>
              <p className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.4em] mb-3">Target Identified</p>
              <h3 className="text-2xl font-black text-white mb-4 tracking-tight leading-tight">{randomPick.title}</h3>
              <div className="flex justify-center gap-3 mb-10">
                 <DifficultyBadge diff={randomPick.difficulty} />
                 <span className="text-[10px] font-black text-slate-500 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono tracking-tighter">LC #{randomPick.id}</span>
              </div>
              <div className="flex flex-col gap-4">
                 <a href={randomPick.link} target="_blank" rel="noreferrer" onClick={() => setRandomPick(null)} className="py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/30 transition-all active:scale-95">Solve Now</a>
                 <button onClick={() => setRandomPick(null)} className="py-5 bg-slate-800/50 hover:bg-slate-800 text-slate-500 rounded-3xl font-bold text-xs uppercase tracking-widest transition-all">Cancel</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
