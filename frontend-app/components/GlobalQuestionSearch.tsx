import React from 'react';
import { Search } from 'lucide-react';
import type { AppThemeClasses, SearchQuestionResult, ThemeMode } from './appTypes';
import { DifficultyBadge } from './appUi';

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
      <div className={`flex h-[60px] items-center gap-3 rounded-2xl border px-5 shadow-inner transition-all focus-within:ring-2 focus-within:ring-purple-500/30 ${theme.input}`}>
        <Search className="h-4 w-4 shrink-0 text-[#94A3B8]" />
        <input
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            onOpenChange(true);
          }}
          onFocus={() => onOpenChange(true)}
          placeholder="Search LC ID or question name..."
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#F8FAFC] outline-none placeholder:text-[#94A3B8]"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              onQueryChange('');
              onOpenChange(false);
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#94A3B8] hover:text-purple-300"
            title="Clear question search"
          >
            Clear
          </button>
        )}
        {!query && (
          <span className="hidden shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2 py-1 font-mono text-[11px] font-bold text-[#CBD5E1] sm:inline-flex">
            <span>⌘</span>
            <span>K</span>
          </span>
        )}
      </div>

      {showResults && (
        <div className="glass-card absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[80] max-h-[420px] overflow-y-auto rounded-2xl p-2">
          {results.length === 0 ? (
            <div className={`p-4 text-sm font-bold ${theme.subtle}`}>No matching questions found.</div>
          ) : (
            results.map((result) => {
              const companyCount = result.companies.length;
              const sourcePreview = result.sourceLabels.slice(0, 2).join(' • ');

              return (
                <button
                  key={result.question.id}
                  type="button"
                  onClick={() => onOpenQuestion(result)}
                  className="w-full rounded-xl p-3 text-left transition-all hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-black ${theme.text}`}>{result.question.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-black text-slate-500">LC #{result.question.id}</span>
                        <DifficultyBadge diff={result.question.difficulty} />
                      </div>
                    </div>
                    {companyCount > 0 && (
                      <span className="shrink-0 rounded-xl border border-green-500/25 bg-green-500/10 px-2.5 py-1 text-[10px] font-black text-green-400">
                        {companyCount} co
                      </span>
                    )}
                  </div>
                  <p className={`mt-2 truncate text-[10px] font-bold ${theme.muted}`}>
                    {companyCount > 0 ? `Asked by ${result.companies.slice(0, 3).map((item) => item.company).join(', ')}` : sourcePreview}
                  </p>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
