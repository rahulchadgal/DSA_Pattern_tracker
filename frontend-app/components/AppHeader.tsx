import React from 'react';
import { Code2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AppThemeClasses } from './appTypes';
import { GlobalStatBadge, WakeBanner } from './appUi';
import { Progress } from './ui/progress';

interface AppHeaderProps {
  theme: AppThemeClasses;
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
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  theme,
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
  onOpenAuth
}) => {
  const navItems = [
    { label: 'Syllabus', active: isSyllabus, onClick: onGoSyllabus },
    { label: 'Companies', active: isProfile, onClick: onGoCompanies },
    { label: 'Roulette', active: isRoulette, onClick: onGoRoulette }
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#081229]/76 px-3 py-2.5 backdrop-blur-2xl sm:px-4 md:px-6 xl:px-8">
      <div className="mx-auto flex min-h-[48px] w-full max-w-[1500px] items-center gap-2 md:gap-3">
        <div className="flex min-w-0 shrink-0 items-center gap-2 md:gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-violet-700 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)]">
            <Code2 className="h-4 w-4" />
          </div>
          <span className="hidden truncate text-sm font-black tracking-normal text-[#F8FAFC] lg:block xl:text-base">
            DSA Pattern Tracker
          </span>
          <WakeBanner visible={isBackendWaking} />
        </div>

        <nav className="relative z-10 flex h-11 shrink-0 items-center gap-1 sm:gap-1.5">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={`relative h-9 shrink-0 overflow-hidden rounded-lg px-2.5 text-[11px] font-bold tracking-normal transition-colors sm:px-3.5 sm:text-xs md:px-4 ${item.active ? 'text-white' : 'text-[#CBD5E1] hover:text-white'}`}
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

        <div className="relative z-0 hidden min-w-0 flex-1 sm:block">{search}</div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden h-11 items-center gap-2 lg:flex">
            {(Object.entries(globalStats) as [string, { total: number; solved: number }][]).map(([diff, data]) => (
              <GlobalStatBadge key={diff} diff={diff} solved={data.solved} total={data.total} />
            ))}
          </div>

          <div className={`hidden h-11 w-[118px] rounded-xl border px-3 py-2 md:block xl:w-[128px] ${theme.panelStrong}`}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${theme.muted}`}>Progress</span>
              <span className={`font-mono text-xs font-black ${theme.text}`}>{overallPercent}%</span>
            </div>
            <Progress value={overallPercent} className="progress-glow h-1.5 bg-white/10 [&>div]:duration-1000" />
          </div>

          <button
            type="button"
            onClick={onOpenAuth}
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all md:h-11 md:w-11 ${theme.panelStrong} hover:border-purple-400/50`}
            title={handle ? `Signed in as @${handle}` : 'Sign in to sync'}
            aria-label={handle ? `Signed in as ${handle}` : 'Sign in to sync'}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${syncStatusConfig.color}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
