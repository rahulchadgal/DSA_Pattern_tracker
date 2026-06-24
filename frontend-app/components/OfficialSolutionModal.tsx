import React, { lazy, Suspense } from 'react';
import { X } from 'lucide-react';
import type { OfficialSolutionEntry } from '../lib/officialSolutions';
import type { Question } from '../types';
import type { ThemeMode } from './appTypes';
import { DifficultyBadge } from './appUi';
import { MarkdownSolutionRenderer } from './MarkdownSolutionRenderer';

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
    <div className="fixed inset-0 z-[106] overflow-y-auto bg-[#081229]/82 p-4 backdrop-blur-2xl md:p-6">
      <div className="glass-card mx-auto my-4 flex min-h-[calc(100vh-2rem)] w-full max-w-[min(96vw,1400px)] flex-col rounded-[2rem] p-5 md:my-6 md:min-h-[calc(100vh-3rem)] md:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black tracking-normal text-[#F8FAFC]">Official Solution</h3>
            <p className="mt-1 text-xs font-medium text-[#94A3B8]">
              LC #{question.id} • {question.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.06] text-[#CBD5E1] transition-all hover:border-purple-400/40 hover:text-white"
            aria-label="Close official solution"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === 'loading' && (
          <div className="glass-panel flex flex-1 items-center justify-center rounded-2xl p-8 text-sm font-bold text-[#CBD5E1]">
            Loading official solution...
          </div>
        )}

        {status === 'missing' && (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6 text-sm text-yellow-100">
            Official solution data is not available for this question yet.
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6 text-sm text-purple-100">
            Unable to load official solution data.
          </div>
        )}

        {status === 'ready' && solution && (
          <div className="flex flex-1 flex-col gap-5 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
              <DifficultyBadge diff={solution.difficulty} />
              {solution.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/[0.12] bg-white/[0.06] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {tag}
                </span>
              ))}
            </div>

          <div className="glass-panel flex flex-wrap gap-2 rounded-2xl p-2">
            <button
              type="button"
              onClick={() => onViewChange('question')}
              className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${view === 'question' ? 'bg-purple-500/30 text-white glow-purple' : 'text-[#94A3B8] hover:text-[#CBD5E1]'}`}
            >
              Question
            </button>
              {hasMeaningfulHint(solution) && (
                <button
                  type="button"
                  onClick={() => onViewChange('hint')}
                  className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${view === 'hint' ? 'bg-purple-500/30 text-white glow-purple' : 'text-[#94A3B8] hover:text-[#CBD5E1]'}`}
                >
                  Show Hint
                </button>
              )}
              <button
                type="button"
                onClick={() => onViewChange('solution')}
                className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${view === 'solution' ? 'bg-purple-500/30 text-white glow-purple' : 'text-[#94A3B8] hover:text-[#CBD5E1]'}`}
              >
                Show Solution
              </button>
            </div>

            <div className="glass-panel min-h-0 flex-1 overflow-y-auto rounded-2xl p-5">
              {view === 'question' && (
                <>
                  <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-purple-300">Question</h4>
                  <div
                    className="prose prose-invert max-w-none text-sm leading-7 text-slate-200 prose-p:text-slate-300 prose-li:text-slate-300 prose-pre:border prose-pre:border-white/[0.12] prose-pre:bg-[#081229]/80"
                    dangerouslySetInnerHTML={{ __html: solution.descriptionHtml }}
                  />
                </>
              )}

              {view === 'hint' && (
                <>
                  <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-yellow-300">Hint / Approach</h4>
                  <div className="rounded-2xl border border-white/[0.12] bg-[#081229]/80 p-4">
                    <MarkdownSolutionRenderer content={solution.solutionMarkdown} />
                  </div>
                </>
              )}

              {view === 'solution' && (
                <>
                  <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-green-300">Java Solution</h4>
                  {solution.hasJava ? (
                    <div className="glass-panel overflow-hidden rounded-2xl">
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
                    <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5 text-sm text-yellow-100">
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
