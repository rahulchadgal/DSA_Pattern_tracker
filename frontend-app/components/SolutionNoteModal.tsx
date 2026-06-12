import React, { lazy, Suspense } from 'react';
import type { Question } from '../types';
import type { ThemeMode } from './appTypes';

const JavaSolutionEditor = lazy(() => import('./JavaSolutionEditor'));

interface SolutionNoteModalProps {
  question: Question | null;
  themeMode: ThemeMode;
  value: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

export const SolutionNoteModal: React.FC<SolutionNoteModalProps> = ({
  question,
  themeMode,
  value,
  isLoading,
  onChange,
  onClose,
  onSave
}) => {
  if (!question) return null;

  return (
    <div className="fixed inset-0 z-[106] overflow-y-auto bg-[#081229]/80 p-4 backdrop-blur-xl md:p-6">
      <div className="glass-card mx-auto my-4 flex min-h-[calc(100vh-2rem)] w-full max-w-[min(96vw,1400px)] flex-col rounded-[2.5rem] p-6 md:my-6 md:min-h-[calc(100vh-3rem)] md:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black tracking-normal text-white">Solution Notes</h3>
            <p className="mt-1 text-xs text-slate-400">
              LC #{question.id} • {question.title}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">X</button>
        </div>

        <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.12] bg-[#081229]/50 px-4 py-2 text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Java Editor</span>
            <span className="font-mono text-[10px] font-bold">{value.length} chars</span>
          </div>
          <Suspense fallback={<div className="flex h-[55vh] items-center justify-center font-mono text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Loading Java editor...</div>}>
            <JavaSolutionEditor
              themeMode={themeMode}
              value={value}
              onChange={onChange}
            />
          </Suspense>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {isLoading ? 'Loading saved note...' : 'Your note is stored per handle and question.'}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-2xl border border-white/[0.12] px-5 py-2.5 text-xs font-black uppercase tracking-[0.15em] text-slate-300"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="rounded-2xl bg-green-600 px-5 py-2.5 text-xs font-black uppercase tracking-[0.15em] text-white hover:bg-green-500"
            >
              Save Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
