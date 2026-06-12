import React from 'react';
import { cn } from '../lib/utils';

export const GlobalStatBadge: React.FC<{ diff: string; solved: number; total: number }> = ({ diff, solved, total }) => {
  const styles = {
    Easy: 'text-green-300 border-green-500/25 bg-green-500/10',
    Medium: 'text-yellow-400 border-yellow-500/25 bg-yellow-500/10',
    Hard: 'text-purple-400 border-purple-500/25 bg-purple-500/10'
  };
  const colorClass = styles[diff as keyof typeof styles] || 'text-slate-300 border-white/[0.12] bg-white/[0.06]';

  return (
    <div className={cn('flex h-11 min-w-[74px] items-center justify-center gap-1.5 rounded-xl border px-2.5 transition-all duration-300 xl:min-w-[80px]', colorClass)}>
      <span className="text-xs font-black">{diff[0]}</span>
      <div className="flex items-baseline gap-0.5">
        <span className="font-mono text-xs font-black">{solved}</span>
        <span className="text-[10px] font-bold text-[#94A3B8]">/{total}</span>
      </div>
    </div>
  );
};

export const DifficultyBadge: React.FC<{ diff: string }> = ({ diff }) => {
  const styles = {
    Easy: 'bg-green-500/10 text-green-300 border-green-500/25',
    Medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25',
    Hard: 'bg-purple-500/10 text-purple-400 border-purple-500/25'
  };

  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest', styles[diff as keyof typeof styles])}>
      {diff}
    </span>
  );
};

export const WakeBanner: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-yellow-300">
      <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
      <span className="text-[10px] font-black uppercase tracking-[0.15em]">Waking backend... retrying automatically</span>
    </div>
  );
};
