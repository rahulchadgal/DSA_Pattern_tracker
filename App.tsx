
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DSA_DATA } from './constants';
import { Section, Pattern, Question } from './types';

// Icons as pure SVG components
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg 
    className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ExternalIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const App: React.FC = () => {
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('dsa-tracker-progress');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedPattern, setSelectedPattern] = useState<Pattern>(DSA_DATA[0].patterns[0]);
  const [openSections, setOpenSections] = useState<string[]>([DSA_DATA[0].id]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('dsa-tracker-progress', JSON.stringify(completedIds));
  }, [completedIds]);

  const toggleQuestion = (id: string) => {
    setCompletedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => 
      prev.includes(sectionId) ? prev.filter(id => id !== sectionId) : [...prev, sectionId]
    );
  };

  const totalQuestionsCount = useMemo(() => {
    return DSA_DATA.reduce((acc, section) => 
      acc + section.patterns.reduce((pAcc, p) => pAcc + p.questions.length, 0), 0
    );
  }, []);

  const overallProgress = Math.round((completedIds.length / totalQuestionsCount) * 100);

  const getPatternProgress = useCallback((pattern: Pattern) => {
    const done = pattern.questions.filter(q => completedIds.includes(q.id)).length;
    return Math.round((done / pattern.questions.length) * 100);
  }, [completedIds]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Mobile Header */}
      <header className="md:hidden bg-slate-900 p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 z-50">
        <h1 className="text-xl font-bold text-emerald-500">DSA Pattern Tracker</h1>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          {isSidebarOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </header>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen w-80 bg-slate-900 border-r border-slate-800 flex flex-col z-50
        transition-transform duration-300 ease-in-out md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-800 hidden md:block">
          <h1 className="text-2xl font-bold text-emerald-500">DSA Pattern Tracker</h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-medium">Developer Edition</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4">
            {DSA_DATA.map(section => (
              <div key={section.id} className="mb-2">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-800 rounded-lg transition-colors group"
                >
                  <span className="text-sm font-semibold text-slate-300 group-hover:text-white">
                    {section.title}
                  </span>
                  <ChevronIcon open={openSections.includes(section.id)} />
                </button>
                
                {openSections.includes(section.id) && (
                  <div className="mt-1 ml-2 space-y-1">
                    {section.patterns.map(pattern => {
                      const progress = getPatternProgress(pattern);
                      const isSelected = selectedPattern.id === pattern.id;
                      return (
                        <button
                          key={pattern.id}
                          onClick={() => {
                            setSelectedPattern(pattern);
                            setIsSidebarOpen(false);
                          }}
                          className={`
                            w-full text-left p-2.5 rounded-md text-sm transition-all relative group
                            ${isSelected ? 'bg-emerald-500/10 text-emerald-400 border-l-4 border-emerald-500' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                          `}
                        >
                          <div className="flex flex-col gap-1">
                            <span className="block truncate">{pattern.name}</span>
                            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 transition-all duration-500" 
                                style={{ width: `${progress}%` }} 
                              />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">Overall Progress</span>
            <span className="text-sm font-bold text-emerald-500">{overallProgress}%</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-1000 ease-out" 
              style={{ width: `${overallProgress}%` }} 
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-3 text-center">
            {completedIds.length} / {totalQuestionsCount} Problems Solved
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full">
        {/* Pattern Header */}
        <div className="mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">{selectedPattern.name}</h2>
              <p className="text-slate-400 max-w-2xl">
                Master this pattern by solving the essential problems listed below. Tracking your progress helps identify gaps in your knowledge.
              </p>
            </div>
            {selectedPattern.videoLink && (
              <a 
                href={selectedPattern.videoLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-red-600/20 text-red-400 border border-red-600/30 px-4 py-2 rounded-lg hover:bg-red-600/30 transition-all font-medium text-sm"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 4-8 4z"/></svg>
                Watch Pattern Theory
              </a>
            )}
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-300">Pattern Mastery</span>
                <span className="text-sm font-bold text-emerald-400">{getPatternProgress(selectedPattern)}%</span>
              </div>
              <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all duration-700" 
                  style={{ width: `${getPatternProgress(selectedPattern)}%` }} 
                />
              </div>
            </div>
            <div className="flex gap-4 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-8">
              <div className="text-center px-4">
                <p className="text-2xl font-bold text-white">{selectedPattern.questions.length}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Total</p>
              </div>
              <div className="text-center px-4">
                <p className="text-2xl font-bold text-emerald-500">
                  {selectedPattern.questions.filter(q => completedIds.includes(q.id)).length}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Solved</p>
              </div>
            </div>
          </div>
        </div>

        {/* Question List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
            Practice Problems
          </h3>
          <div className="grid gap-3">
            {selectedPattern.questions.map((question) => {
              const isDone = completedIds.includes(question.id);
              return (
                <div 
                  key={question.id}
                  className={`
                    group relative bg-slate-900 border rounded-xl p-4 flex items-center justify-between transition-all duration-200
                    ${isDone ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'}
                  `}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <button 
                      onClick={() => toggleQuestion(question.id)}
                      className={`
                        w-6 h-6 rounded border flex items-center justify-center transition-all
                        ${isDone 
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                          : 'border-slate-600 hover:border-emerald-500'
                        }
                      `}
                    >
                      {isDone && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <div className="flex flex-col">
                      <a 
                        href={question.link} 
                        target="_blank" 
                        rel="noreferrer"
                        className={`
                          text-base font-medium flex items-center gap-2 group-hover:text-emerald-400 transition-colors
                          ${isDone ? 'text-slate-500 line-through' : 'text-slate-200'}
                        `}
                      >
                        <span className="mono text-slate-500 text-sm font-normal">#{question.id}</span>
                        {question.title}
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalIcon />
                        </span>
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`
                      text-[10px] px-2 py-1 rounded-full border uppercase tracking-tighter font-bold
                      ${isDone ? 'border-emerald-500/20 text-emerald-500/60' : 'border-slate-700 text-slate-500'}
                    `}>
                      {isDone ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <footer className="mt-16 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-xs">
          <div className="flex flex-wrap justify-center gap-4">
            <a href="https://thita.ai/dashboard/learning-path/dsa" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors">Theory Guide</a>
            <a href="https://discord.gg/zxywjSuvDT" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors">Join Community</a>
            <a href="https://thita.ai/dsa-patterns-sheet" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors">Original Sheet</a>
          </div>
          <p>Curated with ❤️ for DSA Aspirants</p>
        </footer>
      </main>
    </div>
  );
};

export default App;
