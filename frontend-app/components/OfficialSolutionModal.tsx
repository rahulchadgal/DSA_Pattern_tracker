import React, { lazy, Suspense } from 'react';
import type { OfficialSolutionEntry } from '../lib/officialSolutions';
import type { Question } from '../types';
import type { ThemeMode } from './appTypes';
import { DifficultyBadge } from './appUi';

const JavaSolutionEditor = lazy(() => import('./JavaSolutionEditor'));

interface OfficialSolutionModalProps {
  question: Question | null;
  solution: OfficialSolutionEntry | null;
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'error';
  view: 'question' | 'hint' | 'solution';
  themeMode: ThemeMode;
  onClose: () => void;
  onViewChange: (view: 'question' | 'hint' | 'solution') => void;
  hasMeaningfulHint: (solution: OfficialSolutionEntry) => boolean;
}

export const OfficialSolutionModal: React.FC<OfficialSolutionModalProps> = ({
  question,
  solution,
  status,
  view,
  themeMode,
  onClose,
  onViewChange,
  hasMeaningfulHint
}) => {
  if (!question) return null;

  return (
    <div className="fixed inset-0 z-[106] overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-xl md:p-6">
      <div className="mx-auto my-4 flex min-h-[calc(100vh-2rem)] w-full max-w-[min(96vw,1400px)] flex-col rounded-[2.5rem] border border-slate-800 bg-[#0f172a] p-6 md:my-6 md:min-h-[calc(100vh-3rem)] md:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black tracking-normal text-white">Official Solution</h3>
            <p className="mt-1 text-xs text-slate-400">
              LC #{question.id} • {question.title}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">X</button>
        </div>

        {status === 'loading' && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 p-8 text-sm font-bold text-slate-400">
            Loading official solution...
          </div>
        )}

        {status === 'missing' && (
          <div className="rounded-2xl border border-light-gold-500/20 bg-light-gold-500/5 p-6 text-sm text-light-gold-100">
            Official solution data is not available for this question yet.
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-2xl border border-coral-glow-500/20 bg-coral-glow-500/5 p-6 text-sm text-coral-glow-100">
            Unable to load official solution data.
          </div>
        )}

        {status === 'ready' && solution && (
          <div className="flex flex-1 flex-col gap-5 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
              <DifficultyBadge diff={solution.difficulty} />
              {solution.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-2">
              <button
                type="button"
                onClick={() => onViewChange('question')}
                className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${view === 'question' ? 'bg-coral-glow-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Question
              </button>
              {hasMeaningfulHint(solution) && (
                <button
                  type="button"
                  onClick={() => onViewChange('hint')}
                  className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${view === 'hint' ? 'bg-light-gold-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Show Hint
                </button>
              )}
              <button
                type="button"
                onClick={() => onViewChange('solution')}
                className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${view === 'solution' ? 'bg-moss-green-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Show Solution
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-5">
              {view === 'question' && (
                <>
                  <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-coral-glow-300">Question</h4>
                  <div
                    className="pcoral-glow pcoral-glow-invert max-w-none text-sm leading-7 text-slate-200 pcoral-glow-p:text-slate-300 pcoral-glow-li:text-slate-300 pcoral-glow-pre:border pcoral-glow-pre:border-slate-800 pcoral-glow-pre:bg-slate-900"
                    dangerouslySetInnerHTML={{ __html: solution.descriptionHtml }}
                  />
                </>
              )}

              {view === 'hint' && (
                <>
                  <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-light-gold-300">Hint / Approach</h4>
                  <pre className="whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm leading-7 text-slate-200">
                    {solution.solutionMarkdown}
                  </pre>
                </>
              )}

              {view === 'solution' && (
                <>
                  <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-moss-green-300">Java Solution</h4>
                  {solution.hasJava ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#020617]">
                      <Suspense fallback={<div className="flex h-[58vh] items-center justify-center font-mono text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Loading Java viewer...</div>}>
                        <JavaSolutionEditor
                          themeMode={themeMode}
                          value={solution.java}
                          readOnly
                          height="58vh"
                        />
                      </Suspense>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-light-gold-500/20 bg-light-gold-500/5 p-5 text-sm text-light-gold-100">
                      Java solution is unavailable for this problem in the source repo.
                    </div>
                  )}
                  <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    Source: {solution.sourcePath}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
