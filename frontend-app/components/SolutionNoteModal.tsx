import React, { lazy, Suspense } from 'react';
import type { Question } from '../types';
import type { ThemeMode } from './appTypes';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] min-h-[calc(100vh-3rem)] w-[min(96vw,1400px)] max-w-none flex-col rounded-[2.5rem] border-slate-800 bg-[#0f172a] p-6 md:p-8">
        <DialogHeader className="mb-6 flex-row items-start justify-between gap-4 space-y-0 text-left">
          <div>
            <DialogTitle className="text-xl font-black tracking-tight text-white">Solution Notes</DialogTitle>
            <p className="mt-1 text-xs text-slate-400">
              LC #{question.id} • {question.title}
            </p>
          </div>
        </DialogHeader>

        <Card className={`min-h-0 flex-1 overflow-hidden rounded-2xl ${themeMode === 'light' ? 'border-slate-300 bg-white' : 'border-slate-700 bg-slate-950'}`}>
          <CardHeader className={`flex-row items-center justify-between space-y-0 border-b px-4 py-2 ${themeMode === 'light' ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-slate-800 bg-slate-900/80 text-slate-500'}`}>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Java Editor</span>
            <span className="font-mono text-[10px] font-bold">{value.length} chars</span>
          </CardHeader>
          <CardContent className="p-0">
          <Suspense fallback={<div className="flex h-[55vh] items-center justify-center font-mono text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Loading Java editor...</div>}>
            <JavaSolutionEditor
              themeMode={themeMode}
              value={value}
              onChange={onChange}
            />
          </Suspense>
          </CardContent>
        </Card>

        <DialogFooter className="mt-5 items-center justify-between gap-3 sm:justify-between">
          <span className="text-[11px] text-slate-500">
            {isLoading ? 'Loading saved note...' : 'Your note is stored per handle and question.'}
          </span>
          <div className="flex items-center gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="rounded-2xl border-slate-700 text-xs font-black uppercase tracking-[0.15em] text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={onSave}
              className="rounded-2xl bg-emerald-600 text-xs font-black uppercase tracking-[0.15em] text-white hover:bg-emerald-500"
            >
              Save Note
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
