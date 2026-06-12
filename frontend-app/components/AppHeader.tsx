import React from 'react';
import { Code2, Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AppThemeClasses, ThemeMode } from './appTypes';
import { GlobalStatBadge, WakeBanner } from './appUi';
import { Progress } from './ui/progress';

interface AppHeaderProps {
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
    <header className={`sticky top-0 z-20 border-b border-white/10 bg-[#081229]/70 px-4 py-4 backdrop-blur-2xl sm:px-6 md:px-8 xl:px-10`}>
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-violet-700 text-white shadow-[0_0_24px_rgba(168,85,247,0.38)]">
            <Code2 className="h-5 w-5" />
          </div>
          <span className="hidden truncate text-lg font-black tracking-normal text-[#F8FAFC] sm:block xl:max-w-[230px]">
            DSA Pattern Tracker
          </span>
          <WakeBanner visible={isBackendWaking} />
        </div>

        <div className="grid w-full grid-cols-1 items-center gap-4 lg:grid-cols-[auto_minmax(260px,1fr)] 2xl:grid-cols-[auto_minmax(320px,370px)_auto] 2xl:gap-5">
        <nav className="relative z-10 flex h-[52px] w-full items-center gap-2 overflow-x-auto no-scrollbar 2xl:w-auto">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={`relative h-11 min-w-[94px] shrink-0 overflow-hidden rounded-lg px-4 text-sm font-bold tracking-normal transition-colors sm:min-w-[108px] sm:px-5 2xl:min-w-[96px] ${item.active ? 'text-white' : 'text-[#CBD5E1] hover:text-white'}`}
              >
                {item.active && (
                  <motion.span
                    layoutId="app-header-active-tab"
                    className="absolute inset-0 rounded-lg bg-purple-500/80 shadow-[0_0_24px_rgba(168,85,247,0.35)]"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative z-10 block truncate">{item.label}</span>
              </button>
            ))}
        </nav>

        <div className="relative z-0 min-w-0 2xl:w-[370px]">{search}</div>

        <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_56px] items-center gap-3 lg:col-span-2 lg:grid-cols-[auto_auto_56px] 2xl:col-span-1 2xl:ml-auto 2xl:w-auto 2xl:grid-cols-[auto_auto_auto_56px] 2xl:gap-2">
          <div className="hidden h-[60px] items-center gap-2 2xl:flex">
            {(Object.entries(globalStats) as [string, { total: number; solved: number }][]).map(([diff, data]) => (
              <GlobalStatBadge key={diff} diff={diff} solved={data.solved} total={data.total} />
            ))}
          </div>

          <div className={`h-[60px] min-w-0 rounded-xl border px-4 py-2.5 lg:min-w-36 ${theme.panelStrong}`}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.muted}`}>Progress</span>
              <span className={`font-mono text-sm font-black ${theme.text}`}>{overallPercent}%</span>
            </div>
            <Progress value={overallPercent} className="progress-glow h-2 bg-white/10 [&>div]:duration-1000" />
          </div>

          <button
            type="button"
            onClick={onOpenAuth}
            className={`h-[60px] min-w-0 rounded-xl border px-3 py-2.5 text-left transition-all sm:px-4 lg:min-w-36 ${theme.panelStrong} hover:border-purple-400/50`}
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
            className={`inline-flex h-[56px] w-[56px] items-center justify-center rounded-xl border transition-all ${theme.panelStrong} ${theme.subtle} hover:text-purple-400 lg:h-[60px] lg:w-[60px]`}
            title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {themeMode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
        </div>
      </div>
    </header>
  );
};
