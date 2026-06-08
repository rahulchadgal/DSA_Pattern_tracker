import React from 'react';
import { Search } from 'lucide-react';
import type { AppThemeClasses, SearchQuestionResult, ThemeMode } from './appTypes';
import { DifficultyBadge } from './appUi';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';

interface GlobalQuestionSearchProps {
  query: string;
  isOpen: boolean;
  results: SearchQuestionResult[];
  theme: AppThemeClasses;
  themeMode: ThemeMode;
  onQueryChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onOpenQuestion: (result: SearchQuestionResult) => void;
}

export const GlobalQuestionSearch: React.FC<GlobalQuestionSearchProps> = ({
  query,
  isOpen,
  results,
  theme,
  themeMode,
  onQueryChange,
  onOpenChange,
  onOpenQuestion
}) => {
  const trimmedQuery = query.trim();
  const showResults = isOpen && trimmedQuery.length > 0;

  return (
    <div className="relative w-full max-w-2xl xl:flex-1">
      <div className={`flex h-12 items-center gap-3 rounded-2xl border px-4 shadow-inner transition-all focus-within:ring-2 focus-within:ring-indigo-500/30 ${theme.input}`}>
        <Search className="h-4 w-4 shrink-0 text-slate-500" />
        <Input
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            onOpenChange(true);
          }}
          onFocus={() => onOpenChange(true)}
          placeholder="Search LC ID or question name..."
          className="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm font-bold shadow-none outline-none placeholder:text-slate-500 focus-visible:ring-0"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onQueryChange('');
              onOpenChange(false);
            }}
            className="h-auto shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-transparent hover:text-indigo-400"
            title="Clear question search"
          >
            Clear
          </Button>
        )}
      </div>

      {showResults && (
        <Card className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[80] overflow-hidden rounded-2xl shadow-2xl ${themeMode === 'light' ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950'}`}>
          <CardContent className="p-2">
            <ScrollArea className="max-h-[420px]">
              {results.length === 0 ? (
                <div className={`p-4 text-sm font-bold ${theme.subtle}`}>No matching questions found.</div>
              ) : (
                results.map((result) => {
                  const companyCount = result.companies.length;
                  const sourcePreview = result.sourceLabels.slice(0, 2).join(' • ');

                  return (
                    <Button
                      key={result.question.id}
                      type="button"
                      variant="ghost"
                      onClick={() => onOpenQuestion(result)}
                      className={`h-auto w-full justify-start rounded-xl p-3 text-left ${themeMode === 'light' ? 'hover:bg-slate-100' : 'hover:bg-slate-900'}`}
                    >
                      <div className="w-full min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-black ${theme.text}`}>{result.question.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[10px] font-black text-slate-500">LC #{result.question.id}</span>
                              <DifficultyBadge diff={result.question.difficulty} />
                            </div>
                          </div>
                          {companyCount > 0 && (
                            <Badge variant="outline" className="shrink-0 rounded-xl border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-500">
                              {companyCount} co
                            </Badge>
                          )}
                        </div>
                        <p className={`mt-2 truncate text-[10px] font-bold ${theme.muted}`}>
                          {companyCount > 0 ? `Asked by ${result.companies.slice(0, 3).map((item) => item.company).join(', ')}` : sourcePreview}
                        </p>
                      </div>
                    </Button>
                  );
                })
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
