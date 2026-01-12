
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DSA_DATA } from './constants';
import { Pattern } from './types';

// We use a robust key for local and a fallback for cloud
const STORAGE_KEY = 'dsa-tracker-v6';
const CLOUD_API_BASE = "https://keyvalue.xyz";

// UI Components
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
);
const ExternalIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
);
const CloudStatus = ({ status }: { status: string }) => {
  const colors = {
    syncing: 'bg-emerald-400 animate-pulse',
    synced: 'bg-emerald-500',
    error: 'bg-amber-500',
    idle: 'bg-slate-700'
  };
  return <div className={`w-2 h-2 rounded-full ${colors[status as keyof typeof colors] || colors.idle}`} />;
};

const App: React.FC = () => {
  // --- CORE DATA STATE ---
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  // --- SETTINGS & SYNC STATE ---
  const [syncKey, setSyncKey] = useState<string>(() => localStorage.getItem('dsa-sync-key') || `user_${Math.random().toString(36).substr(2, 9)}`);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'error' | 'idle'>('idle');
  const [lastSynced, setLastSynced] = useState<string | null>(localStorage.getItem('dsa-last-sync'));
  
  // --- UI STATE ---
  const [selectedPattern, setSelectedPattern] = useState<Pattern>(DSA_DATA[0].patterns[0]);
  const [openSections, setOpenSections] = useState<string[]>([DSA_DATA[0].id]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  
  const isInitialMount = useRef(true);

  // --- SYNC ENGINE (LOCAL-FIRST) ---
  const performCloudSync = useCallback(async (data: string[]) => {
    if (!syncKey) return;
    setSyncStatus('syncing');
    try {
      // We use a body-based POST to avoid "URL Too Long" errors
      const response = await fetch(`${CLOUD_API_BASE}/${syncKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setSyncStatus('synced');
        setLastSynced(time);
        localStorage.setItem('dsa-last-sync', time);
      } else {
        setSyncStatus('error');
      }
    } catch (e) {
      // Silent fail: Don't show an error message, just update status
      setSyncStatus('error');
    }
  }, [syncKey]);

  const fetchCloudData = useCallback(async () => {
    try {
      const res = await fetch(`${CLOUD_API_BASE}/get/${syncKey}`);
      if (res.ok) {
        const text = await res.text();
        if (text && text !== "null") {
          const cloudData = JSON.parse(text);
          if (Array.isArray(cloudData) && cloudData.length > completedIds.length) {
            setCompletedIds(cloudData);
            setSyncStatus('synced');
          }
        }
      }
    } catch (e) {
      setSyncStatus('error');
    }
  }, [syncKey, completedIds.length]);

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => {
    localStorage.setItem('dsa-sync-key', syncKey);
    fetchCloudData();
  }, [syncKey, fetchCloudData]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completedIds));
    
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Debounce cloud save to avoid spamming the server
    const timeout = setTimeout(() => performCloudSync(completedIds), 2000);
    return () => clearTimeout(timeout);
  }, [completedIds, performCloudSync]);

  // --- DATA MANAGEMENT ---
  const exportProgress = () => {
    const data = JSON.stringify(completedIds, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dsa-progress-backup.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importProgress = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          setCompletedIds(json);
          setShowDataModal(false);
          alert("Progress Imported Successfully!");
        }
      } catch (err) {
        alert("Error: File is not a valid progress JSON.");
      }
    };
    reader.readAsText(file);
  };

  // --- HANDLERS ---
  const toggleQuestion = (id: string) => {
    setCompletedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const totalPossible = useMemo(() => 
    DSA_DATA.reduce((acc, s) => acc + s.patterns.reduce((pA, p) => pA + p.questions.length, 0), 0)
  , []);

  const overallPercent = Math.round((completedIds.length / totalPossible) * 100);

  const getPatternPercent = (pattern: Pattern) => {
    const done = pattern.questions.filter(q => completedIds.includes(q.id)).length;
    return Math.round((done / pattern.questions.length) * 100);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#020617] text-slate-200">
      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen w-80 bg-[#0f172a] border-r border-slate-800 flex flex-col z-50
        transition-transform duration-300 md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter">DSA <span className="text-emerald-500">PRO</span></h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">94 Logic Patterns</p>
          </div>
          <button onClick={() => setShowDataModal(true)} className="p-2 text-slate-500 hover:text-emerald-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {DSA_DATA.map(section => (
            <div key={section.id} className="mb-2">
              <button 
                onClick={() => setOpenSections(prev => prev.includes(section.id) ? prev.filter(i => i !== section.id) : [...prev, section.id])}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/50 transition-all text-left"
              >
                <span className="text-sm font-bold text-slate-400">{section.title}</span>
                <ChevronIcon open={openSections.includes(section.id)} />
              </button>
              {openSections.includes(section.id) && (
                <div className="mt-1 ml-3 space-y-1">
                  {section.patterns.map(pattern => {
                    const active = selectedPattern.id === pattern.id;
                    const pct = getPatternPercent(pattern);
                    return (
                      <button 
                        key={pattern.id}
                        onClick={() => { setSelectedPattern(pattern); setIsSidebarOpen(false); }}
                        className={`w-full p-2.5 rounded-lg text-sm text-left transition-all relative ${active ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500 shadow-lg shadow-emerald-500/5' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="truncate pr-4">{pattern.name}</span>
                          <span className="text-[10px] font-bold">{pct}%</span>
                        </div>
                        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500/50 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Sync Footer */}
        <div className="p-6 border-t border-slate-800/50 bg-slate-900/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CloudStatus status={syncStatus} />
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Local Only' : 'Cloud Backed Up'}
              </span>
            </div>
            {lastSynced && <span className="text-[9px] text-slate-600 font-mono italic">Saved {lastSynced}</span>}
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-400">Total Mastery</span>
              <span className="text-emerald-500">{overallPercent}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.3)]" style={{ width: `${overallPercent}%` }} />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full overflow-x-hidden">
        <header className="md:hidden flex items-center justify-between mb-8">
           <h1 className="text-xl font-black text-emerald-500">DSA PRO</h1>
           <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-slate-900 rounded-xl text-slate-400">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
           </button>
        </header>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h2 className="text-4xl font-black text-white mb-4 tracking-tight leading-none">{selectedPattern.name}</h2>
              <p className="text-slate-400 text-lg max-w-xl leading-relaxed">Master this pattern by solving these {selectedPattern.questions.length} hand-picked problems.</p>
            </div>
            {selectedPattern.videoLink && (
              <a href={selectedPattern.videoLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl hover:bg-red-500/20 transition-all font-bold text-sm">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 4-8 4z"/></svg>
                Theory Guide
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
             <div className="md:col-span-2 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm">
               <div className="flex justify-between items-center mb-4">
                 <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Progress</span>
                 <span className="text-xl font-black text-emerald-400">{getPatternPercent(selectedPattern)}%</span>
               </div>
               <div className="h-5 w-full bg-slate-950 rounded-full p-1 border border-slate-800">
                 <div className="h-full bg-emerald-500 rounded-full transition-all duration-700 shadow-[0_0_20px_rgba(16,185,129,0.3)]" style={{ width: `${getPatternPercent(selectedPattern)}%` }} />
               </div>
             </div>
             <div className="bg-emerald-500/[0.03] border border-emerald-500/20 rounded-3xl p-8 flex items-center justify-around text-center">
                <div>
                  <p className="text-3xl font-black text-white">{selectedPattern.questions.length}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Total</p>
                </div>
                <div className="w-px h-10 bg-slate-800" />
                <div>
                  <p className="text-3xl font-black text-emerald-500">{selectedPattern.questions.filter(q => completedIds.includes(q.id)).length}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Solved</p>
                </div>
             </div>
          </div>

          <div className="space-y-4">
             <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
               <div className="w-2 h-8 bg-emerald-500 rounded-full" />
               Problems to Conquer
             </h3>
             <div className="grid gap-3">
               {selectedPattern.questions.map(q => {
                 const done = completedIds.includes(q.id);
                 return (
                   <div key={q.id} className={`group flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 ${done ? 'bg-emerald-500/[0.02] border-emerald-500/30 shadow-inner' : 'bg-slate-900/50 border-slate-800 hover:border-slate-600 hover:bg-slate-800/40'}`}>
                      <div className="flex items-center gap-6 flex-1">
                        <button 
                          onClick={() => toggleQuestion(q.id)}
                          className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all ${done ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-950 border-slate-700 hover:border-emerald-500'}`}
                        >
                          {done && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </button>
                        <div className="flex flex-col">
                           <a href={q.link} target="_blank" rel="noreferrer" className={`text-lg font-bold flex items-center gap-2 transition-all ${done ? 'text-slate-500 line-through' : 'text-slate-100 hover:text-emerald-400'}`}>
                             {q.title}
                             <span className="opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0"><ExternalIcon /></span>
                           </a>
                           <div className="flex items-center gap-3 mt-1.5">
                             <span className="text-[10px] font-black text-slate-700 uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-800">LC #{q.id}</span>
                             {done && <span className="text-[10px] font-black text-emerald-600 uppercase">Completed ✓</span>}
                           </div>
                        </div>
                      </div>
                   </div>
                 );
               })}
             </div>
          </div>
        </div>
      </main>

      {/* Data Management Modal */}
      {showDataModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
            <button onClick={() => setShowDataModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <h3 className="text-2xl font-black text-white mb-2">Sync & Backup</h3>
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">Ensure your hard work is safe. Use the JSON backup to manually sync via Google Drive or other devices.</p>

            <div className="space-y-6">
               <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">Sync ID (Cloud)</label>
                  <input 
                    type="text" 
                    value={syncKey}
                    onChange={(e) => setSyncKey(e.target.value)}
                    className="w-full bg-transparent border-none text-emerald-400 font-mono text-sm focus:ring-0 p-0"
                    placeholder="Set unique key..."
                  />
                  <p className="text-[9px] text-slate-600 mt-2 uppercase tracking-tighter">Use this key to load progress on other browsers.</p>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <button onClick={exportProgress} className="p-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-xs transition-all flex flex-col items-center gap-2 group border border-slate-700 hover:border-emerald-500">
                    <svg className="w-6 h-6 text-slate-400 group-hover:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Export JSON
                  </button>
                  <label className="p-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-xs transition-all flex flex-col items-center gap-2 cursor-pointer group border border-slate-700 hover:border-emerald-500 text-center">
                    <svg className="w-6 h-6 text-slate-400 group-hover:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Import JSON
                    <input type="file" accept=".json" onChange={importProgress} className="hidden" />
                  </label>
               </div>

               <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                  <p className="text-[11px] text-emerald-400/80 leading-relaxed italic">
                    "Export JSON" generates a file you can save in your Google Drive. It is the most reliable way to keep a permanent backup.
                  </p>
               </div>

               <button onClick={() => setShowDataModal(false)} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-emerald-900/20">
                  GOT IT
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
