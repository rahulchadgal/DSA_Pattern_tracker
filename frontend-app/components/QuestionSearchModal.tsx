import React from 'react';
import type { AppThemeClasses, CompanyTimeFilter, SearchQuestionResult, ThemeMode } from './appTypes';
import { DifficultyBadge } from './appUi';
import type { Question } from '../types';

interface QuestionSearchModalProps {
  selectedSearchQuestion: SearchQuestionResult | null;
  solutionMap: Record<string, string>;
  solutionNotePresenceMap: Record<string, boolean>;
  companyTimeFilters: Array<[CompanyTimeFilter, string]>;
  theme: AppThemeClasses;
  themeMode: ThemeMode;
  onClose: () => void;
  onOpenOfficialSolution: (question: Question) => void | Promise<void>;
  onOpenSolutionEditor: (question: Question) => void;
}

export const QuestionSearchModal: React.FC<QuestionSearchModalProps> = ({
  selectedSearchQuestion,
  solutionMap,
  solutionNotePresenceMap,
  companyTimeFilters,
  theme,
  themeMode,
  onClose,
  onOpenOfficialSolution,
  onOpenSolutionEditor
}) => {
  if (!selectedSearchQuestion) return null;

  const hasSolution = solutionNotePresenceMap[selectedSearchQuestion.question.id] || solutionMap[selectedSearchQuestion.question.id];

  return (
    <div className="fixed inset-0 z-[105] overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-xl md:p-6">
      <div className={`mx-auto my-4 w-full max-w-4xl rounded-[2rem] border p-6 shadow-2xl md:my-8 md:p-8 ${themeMode === 'light' ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#0f172a]'}`}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${theme.muted}`}>Question Lookup</p>
            <h3 className={`mt-2 text-2xl font-black tracking-normal ${theme.text}`}>{selectedSearchQuestion.question.title}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-black text-slate-500">LC #{selectedSearchQuestion.question.id}</span>
              <DifficultyBadge diff={selectedSearchQuestion.question.difficulty} />
            </div>
          </div>
          <button
            onClick={onClose}
            className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-black ${theme.panelStrong} ${theme.subtle} hover:text-coral-glow-400`}
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
            className="inline-flex items-center gap-2 rounded-xl border border-coral-glow-500/30 bg-coral-glow-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-coral-glow-400 hover:bg-coral-glow-500/20"
          >
            Open LeetCode
          </a>
          <button
            type="button"
            onClick={() => onOpenOfficialSolution(selectedSearchQuestion.question)}
            className="inline-flex items-center gap-2 rounded-xl border border-coral-glow-500/30 bg-coral-glow-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-coral-glow-400 hover:bg-coral-glow-500/20"
          >
            Official Solution
          </button>
          <button
            type="button"
            onClick={() => onOpenSolutionEditor(selectedSearchQuestion.question)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest ${hasSolution ? 'border-moss-green-500/30 bg-moss-green-500/10 text-moss-green-500' : themeMode === 'light' ? 'border-slate-300 bg-slate-50 text-slate-500 hover:text-coral-glow-500' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-coral-glow-300'}`}
          >
            {hasSolution ? 'Edit Note' : 'Add Note'}
          </button>
        </div>

        <div className={`rounded-2xl border p-5 ${theme.panelStrong}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className={`text-sm font-black uppercase tracking-[0.2em] ${theme.text}`}>Asked By Companies</h4>
            <span className="rounded-xl border border-moss-green-500/25 bg-moss-green-500/10 px-2.5 py-1 text-[10px] font-black text-moss-green-500">
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
                        <span key={bucket} className={`rounded-lg px-2 py-0.5 text-[9px] font-black uppercase ${bucket === 'all' ? 'bg-coral-glow-500/10 text-coral-glow-400' : 'bg-moss-green-500/10 text-moss-green-500'}`}>
                          {companyTimeFilters.find(([value]) => value === bucket)?.[1] || bucket}
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
  );
};
