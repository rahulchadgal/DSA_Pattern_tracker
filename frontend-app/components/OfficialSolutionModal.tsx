import React, { lazy, Suspense } from 'react';
import type { OfficialSolutionEntry } from '../lib/officialSolutions';
import type { Question } from '../types';
import type { ThemeMode } from './appTypes';
import { DifficultyBadge } from './appUi';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] min-h-[calc(100vh-3rem)] w-[min(96vw,1400px)] max-w-none flex-col rounded-[2.5rem] border-slate-800 bg-[#0f172a] p-6 md:p-8">
        <DialogHeader className="mb-6 flex-row items-start justify-between gap-4 space-y-0 text-left">
          <div>
            <DialogTitle className="text-xl font-black tracking-tight text-white">Official Solution</DialogTitle>
            <p className="mt-1 text-xs text-slate-400">
              LC #{question.id} • {question.title}
            </p>
          </div>
        </DialogHeader>

        {status === 'loading' && (
          <Card className="flex flex-1 items-center justify-center rounded-2xl border-slate-800 bg-slate-950 p-8 text-sm font-bold text-slate-400">
            Loading official solution...
          </Card>
        )}

        {status === 'missing' && (
          <Card className="rounded-2xl border-amber-500/20 bg-amber-500/5 p-6 text-sm text-amber-100">
            Official solution data is not available for this question yet.
          </Card>
        )}

        {status === 'error' && (
          <Card className="rounded-2xl border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-100">
            Unable to load official solution data.
          </Card>
        )}

        {status === 'ready' && solution && (
          <div className="flex flex-1 flex-col gap-5 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
              <DifficultyBadge diff={solution.difficulty} />
              {solution.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="rounded-full border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {tag}
                </Badge>
              ))}
            </div>

            <Tabs
              value={view}
              onValueChange={(value) => onViewChange(value as 'question' | 'hint' | 'solution')}
              className="flex min-h-0 flex-1 flex-col gap-3"
            >
              <TabsList className="h-auto w-fit flex-wrap rounded-2xl border border-slate-800 bg-slate-950 p-2">
                <TabsTrigger value="question" className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Question</TabsTrigger>
                {hasMeaningfulHint(solution) && (
                  <TabsTrigger value="hint" className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-amber-600 data-[state=active]:text-white">Show Hint</TabsTrigger>
                )}
                <TabsTrigger value="solution" className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Show Solution</TabsTrigger>
              </TabsList>

              <Card className="min-h-0 flex-1 overflow-hidden rounded-2xl border-slate-800 bg-slate-950">
                <CardContent className="h-full p-5">
              <TabsContent value="question" className="m-0 h-full">
                <ScrollArea className="h-full">
                <>
                  <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Question</h4>
                  <div
                    className="prose prose-invert max-w-none text-sm leading-7 text-slate-200 prose-p:text-slate-300 prose-li:text-slate-300 prose-pre:border prose-pre:border-slate-800 prose-pre:bg-slate-900"
                    dangerouslySetInnerHTML={{ __html: solution.descriptionHtml }}
                  />
                </>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="hint" className="m-0 h-full">
                <ScrollArea className="h-full">
                <>
                  <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Hint / Approach</h4>
                  <pre className="whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm leading-7 text-slate-200">
                    {solution.solutionMarkdown}
                  </pre>
                </>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="solution" className="m-0 h-full">
                <>
                  <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Java Solution</h4>
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
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-100">
                      Java solution is unavailable for this problem in the source repo.
                    </div>
                  )}
                  <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    Source: {solution.sourcePath}
                  </p>
                </>
              </TabsContent>
                </CardContent>
              </Card>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
