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
    <div className="fixed inset-0 z-[105] overflow-y-auto bg-[#081229]/80 p-4 backdrop-blur-xl md:p-6">
      <div className="glass-card mx-auto my-4 w-full max-w-4xl rounded-[2rem] p-6 md:my-8 md:p-8">
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
            className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-black ${theme.panelStrong} ${theme.subtle} hover:text-purple-400`}
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
            className="inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-purple-400 hover:bg-purple-500/20"
          >
            Open LeetCode
          </a>
          <button
            type="button"
            onClick={() => onOpenOfficialSolution(selectedSearchQuestion.question)}
            className="inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-purple-400 hover:bg-purple-500/20"
          >
            Official Solution
          </button>
          <button
            type="button"
            onClick={() => onOpenSolutionEditor(selectedSearchQuestion.question)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest ${hasSolution ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-white/[0.12] bg-white/[0.06] text-slate-300 hover:text-purple-300'}`}
          >
            {hasSolution ? 'Edit Note' : 'Add Note'}
          </button>
        </div>

        <div className={`rounded-2xl border p-5 ${theme.panelStrong}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className={`text-sm font-black uppercase tracking-[0.2em] ${theme.text}`}>Asked By Companies</h4>
            <span className="rounded-xl border border-green-500/25 bg-green-500/10 px-2.5 py-1 text-[10px] font-black text-green-400">
              {selectedSearchQuestion.companies.length}
            </span>
          </div>

          {selectedSearchQuestion.companies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.12] p-5 text-sm font-bold text-slate-400">
              No company mentions are available for this question in the current company bank.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {selectedSearchQuestion.companies.map((mention) => (
                <div key={mention.company} className="rounded-xl border border-white/[0.12] bg-white/[0.06] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className={`min-w-0 truncate text-sm font-black ${theme.text}`} title={mention.company}>{mention.company}</p>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {mention.buckets.map((bucket) => (
                        <span key={bucket} className={`rounded-lg px-2 py-0.5 text-[9px] font-black uppercase ${bucket === 'all' ? 'bg-purple-500/10 text-purple-400' : 'bg-green-500/10 text-green-400'}`}>
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
