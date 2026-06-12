import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
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
    <header className={`sticky top-0 z-20 border-b px-4 py-4 sm:px-6 md:px-10 xl:px-12 ${theme.header}`}>
      <div className="mx-auto grid min-h-[148px] w-full max-w-[1450px] grid-cols-1 gap-5 lg:min-h-[126px] xl:min-h-[92px] xl:grid-cols-[minmax(260px,360px)_minmax(280px,1fr)_auto] xl:items-center">
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center xl:grid-cols-1">
          <div className="min-w-0">
            <h2 title={title} className={`truncate text-xl font-black tracking-normal md:text-2xl ${theme.text}`}>{title}</h2>
            <WakeBanner visible={isBackendWaking} />
          </div>
          <div className={`grid h-[60px] w-full grid-cols-3 rounded-[20px] border p-1.5 shadow-inner sm:w-[348px] xl:w-full ${theme.panelStrong}`}>
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={`relative h-full overflow-hidden rounded-xl px-2 text-[10px] font-black uppercase tracking-normal transition-colors ${item.active ? 'text-white' : `${theme.muted} hover:text-purple-400`}`}
              >
                {item.active && (
                  <motion.span
                    layoutId="app-header-active-tab"
                    className="absolute inset-0 rounded-xl bg-purple-500/25 glow-purple"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative z-10 block truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 xl:max-w-2xl">{search}</div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_60px] items-center gap-5 lg:grid-cols-[auto_minmax(150px,170px)_minmax(170px,190px)_60px] xl:justify-end">
          <div className="glass-panel hidden h-[60px] items-center gap-1.5 rounded-2xl p-1.5 lg:flex">
            {(Object.entries(globalStats) as [string, { total: number; solved: number }][]).map(([diff, data]) => (
              <GlobalStatBadge key={diff} diff={diff} solved={data.solved} total={data.total} />
            ))}
          </div>

          <div className={`h-[60px] rounded-2xl border px-4 py-2.5 ${theme.panelStrong}`}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.muted}`}>Progress</span>
              <span className={`font-mono text-sm font-black ${theme.text}`}>{overallPercent}%</span>
            </div>
            <Progress value={overallPercent} className="progress-glow h-2 bg-white/10 [&>div]:duration-1000" />
          </div>

          <button
            type="button"
            onClick={onOpenAuth}
            className={`h-[60px] rounded-2xl border px-3 py-2.5 text-left transition-all sm:px-4 ${theme.panelStrong} hover:border-purple-400/50`}
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
            className={`inline-flex h-[60px] w-[60px] items-center justify-center rounded-2xl border transition-all ${theme.panelStrong} ${theme.subtle} hover:text-purple-400`}
            title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {themeMode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
