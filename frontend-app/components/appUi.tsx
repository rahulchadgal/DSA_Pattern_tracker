import React from 'react';
import { cn } from '../lib/utils';
import { Badge } from './ui/badge';

export const GlobalStatBadge: React.FC<{ diff: string; solved: number; total: number }> = ({ diff, solved, total }) => {
  const styles = {
    Easy: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    Medium: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
    Hard: 'text-rose-400 border-rose-500/20 bg-rose-500/5'
  };
  const colorClass = styles[diff as keyof typeof styles] || 'text-slate-400 border-slate-800 bg-slate-900';

  return (
    <Badge variant="outline" className={cn('flex items-center gap-2 rounded-xl px-3 py-1.5 transition-all duration-300', colorClass)}>
      <span className="text-[10px] font-black">{diff[0]}</span>
      <div className="flex items-baseline gap-0.5">
        <span className="font-mono text-xs font-black">{solved}</span>
        <span className="text-[9px] font-bold opacity-40">/{total}</span>
      </div>
    </Badge>
  );
};

export const DifficultyBadge: React.FC<{ diff: string }> = ({ diff }) => {
  const styles = {
    Easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Hard: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  };

  return (
    <Badge variant="outline" className={cn('rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest', styles[diff as keyof typeof styles])}>
      {diff}
    </Badge>
  );
};

export const WakeBanner: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-300">
      <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
      <span className="text-[10px] font-black uppercase tracking-[0.15em]">Waking backend... retrying automatically</span>
    </div>
  );
};
