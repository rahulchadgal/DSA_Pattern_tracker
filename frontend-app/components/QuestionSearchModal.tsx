import React from 'react';
import type { AppThemeClasses, CompanyTimeFilter, SearchQuestionResult, ThemeMode } from './appTypes';
import { DifficultyBadge } from './appUi';
import type { Question } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`max-h-[92vh] max-w-4xl overflow-hidden rounded-[2rem] p-0 ${themeMode === 'light' ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#0f172a]'}`}>
        <ScrollArea className="max-h-[92vh]">
          <div className="p-6 md:p-8">
        <DialogHeader className="mb-6 flex-row items-start justify-between gap-4 space-y-0 text-left">
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${theme.muted}`}>Question Lookup</p>
            <DialogTitle className={`mt-2 text-2xl font-black tracking-tight ${theme.text}`}>{selectedSearchQuestion.question.title}</DialogTitle>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-black text-slate-500">LC #{selectedSearchQuestion.question.id}</span>
              <DifficultyBadge diff={selectedSearchQuestion.question.difficulty} />
            </div>
          </div>
        </DialogHeader>

        <div className="mb-6 flex flex-wrap gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-xl border-indigo-500/30 bg-indigo-500/10 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/20"
          >
            <a
            href={selectedSearchQuestion.question.link}
            target="_blank"
            rel="noreferrer"
            >
              Open LeetCode
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenOfficialSolution(selectedSearchQuestion.question)}
            className="rounded-xl border-indigo-500/30 bg-indigo-500/10 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/20"
          >
            Official Solution
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenSolutionEditor(selectedSearchQuestion.question)}
            className={`rounded-xl text-[10px] font-black uppercase tracking-widest ${hasSolution ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : themeMode === 'light' ? 'border-slate-300 bg-slate-50 text-slate-500 hover:text-indigo-500' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-indigo-300'}`}
          >
            {hasSolution ? 'Edit Note' : 'Add Note'}
          </Button>
        </div>

        <Card className={`rounded-2xl ${theme.panelStrong}`}>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 p-5 pb-4">
            <CardTitle className={`text-sm font-black uppercase tracking-[0.2em] ${theme.text}`}>Asked By Companies</CardTitle>
            <Badge variant="outline" className="rounded-xl border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-500">
              {selectedSearchQuestion.companies.length}
            </Badge>
          </CardHeader>
          <CardContent className="p-5 pt-0">

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
                        <Badge key={bucket} variant="outline" className={`rounded-lg border-transparent px-2 py-0.5 text-[9px] font-black uppercase ${bucket === 'all' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-500'}`}>
                          {companyTimeFilters.find(([value]) => value === bucket)?.[1] || bucket}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </CardContent>
        </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
