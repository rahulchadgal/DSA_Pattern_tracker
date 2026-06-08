import React from 'react';
import { Moon, Sun } from 'lucide-react';
import type { AppThemeClasses, ThemeMode } from './appTypes';
import { GlobalStatBadge, WakeBanner } from './appUi';
import { Progress } from './ui/progress';

interface AppHeaderProps {
  title: string;
  theme: AppThemeClasses;
  themeMode: ThemeMode;
  isBackendWaking: boolean;
  isSyllabus: boolean;
  isProfile: boolean;
  isRoulette: boolean;
  search: React.ReactNode;
  globalStats: Record<string, { total: number; solved: number }>;
  overallPercent: number;
  handle: string;
  syncStatusConfig: { color: string; label: string };
  onGoSyllabus: () => void;
  onGoCompanies: () => void;
  onGoRoulette: () => void;
  onOpenAuth: () => void;
  onToggleTheme: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  theme,
  themeMode,
  isBackendWaking,
  isSyllabus,
  isProfile,
  isRoulette,
  search,
  globalStats,
  overallPercent,
  handle,
  syncStatusConfig,
  onGoSyllabus,
  onGoCompanies,
  onGoRoulette,
  onOpenAuth,
  onToggleTheme
}) => {
  const navItems = [
    { label: 'Syllabus', active: isSyllabus, onClick: onGoSyllabus },
    { label: 'Companies', active: isProfile, onClick: onGoCompanies },
    { label: 'Roulette', active: isRoulette, onClick: onGoRoulette }
  ];

  return (
    <header className={`sticky top-0 z-20 border-b px-8 py-6 backdrop-blur-2xl md:px-14 md:py-8 ${theme.header}`}>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className={`text-xl font-black tracking-tighter md:text-2xl ${theme.text}`}>{title}</h2>
            <WakeBanner visible={isBackendWaking} />
          </div>
          <div className={`flex w-fit rounded-2xl border p-1 shadow-inner ${theme.panelStrong}`}>
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${item.active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : `${theme.muted} hover:text-indigo-400`}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {search}

        <div className="flex flex-wrap items-center gap-4 xl:justify-end">
          <div className="hidden gap-1.5 rounded-xl border border-slate-800/50 bg-slate-950 p-1 lg:flex">
            {(Object.entries(globalStats) as [string, { total: number; solved: number }][]).map(([diff, data]) => (
              <GlobalStatBadge key={diff} diff={diff} solved={data.solved} total={data.total} />
            ))}
          </div>

          <div className={`min-w-[150px] rounded-2xl border px-4 py-3 ${theme.panelStrong}`}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.muted}`}>Progress</span>
              <span className={`font-mono text-sm font-black ${theme.text}`}>{overallPercent}%</span>
            </div>
            <Progress value={overallPercent} className="h-1.5 bg-slate-800/70 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-indigo-500 [&>div]:duration-1000" />
          </div>

          <button
            type="button"
            onClick={onOpenAuth}
            className={`min-w-[178px] rounded-2xl border px-4 py-3 text-left transition-all ${theme.panelStrong} hover:border-indigo-500/40`}
            title={handle ? `Signed in as @${handle}` : 'Sign in to sync'}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className={`block truncate text-[10px] font-black uppercase tracking-[0.2em] ${theme.muted}`}>
                  {handle ? `@${handle}` : 'guest'}
                </span>
                <span className={`mt-1 block truncate text-[10px] font-bold ${theme.subtle}`}>{syncStatusConfig.label}</span>
              </div>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${syncStatusConfig.color}`} />
            </div>
          </button>

          <button
            onClick={onToggleTheme}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all ${theme.panelStrong} ${theme.subtle} hover:text-indigo-400`}
            title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {themeMode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
