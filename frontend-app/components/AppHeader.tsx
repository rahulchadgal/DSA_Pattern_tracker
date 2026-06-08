import React from 'react';
import { Moon, Sun } from 'lucide-react';
import type { AppThemeClasses, ThemeMode } from './appTypes';
import { GlobalStatBadge, WakeBanner } from './appUi';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu';
import { Progress } from './ui/progress';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

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
          <Tabs
            value={isProfile ? 'companies' : isRoulette ? 'roulette' : 'syllabus'}
            onValueChange={(value) => {
              if (value === 'companies') onGoCompanies();
              else if (value === 'roulette') onGoRoulette();
              else onGoSyllabus();
            }}
          >
            <TabsList className={`h-auto rounded-2xl border p-1 shadow-inner ${theme.panelStrong}`}>
              {navItems.map((item) => (
                <TabsTrigger
                  key={item.label}
                  value={item.label.toLowerCase()}
                  className="rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-600/20"
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {search}

        <div className="flex flex-wrap items-center gap-4 xl:justify-end">
          <div className="hidden gap-1.5 rounded-xl border border-slate-800/50 bg-slate-950 p-1 lg:flex">
            {(Object.entries(globalStats) as [string, { total: number; solved: number }][]).map(([diff, data]) => (
              <GlobalStatBadge key={diff} diff={diff} solved={data.solved} total={data.total} />
            ))}
          </div>

          <Card className={`min-w-[150px] rounded-2xl ${theme.panelStrong}`}>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.muted}`}>Progress</span>
                <span className={`font-mono text-sm font-black ${theme.text}`}>{overallPercent}%</span>
              </div>
              <Progress value={overallPercent} className="h-1.5 bg-slate-800/70 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-indigo-500 [&>div]:duration-1000" />
            </CardContent>
          </Card>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={`h-auto min-w-[178px] justify-between rounded-2xl px-4 py-3 text-left ${theme.panelStrong} hover:border-indigo-500/40 hover:bg-transparent`}
                title={handle ? `Signed in as @${handle}` : 'Sign in to sync'}
              >
                <span className="min-w-0">
                  <span className={`block truncate text-[10px] font-black uppercase tracking-[0.2em] ${theme.muted}`}>
                    {handle ? `@${handle}` : 'guest'}
                  </span>
                  <span className={`mt-1 block truncate text-[10px] font-bold ${theme.subtle}`}>{syncStatusConfig.label}</span>
                </span>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${syncStatusConfig.color}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{handle ? `@${handle}` : 'Guest session'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onOpenAuth}>
                {handle ? 'Account / Login' : 'Sign in to sync'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onToggleTheme}
                  className={`h-11 w-11 rounded-2xl ${theme.panelStrong} ${theme.subtle} hover:bg-transparent hover:text-indigo-400`}
                >
                  {themeMode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </header>
  );
};
